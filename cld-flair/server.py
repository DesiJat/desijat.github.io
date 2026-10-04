#!/usr/bin/env python3
"""
server.py - two-file reverse tunnel server.

Features:
- outbound-only client tunnel
- multiple tunnel connections per client
- multiplexed TCP streams
- hostname-based routing for HTTP/HTTPS TCP passthrough
- token authentication
- TLS for tunnel and public listeners (optional)
- health/status endpoint
- idle/heartbeat detection
- connection/stream limits
- graceful shutdown
- standard library only

Example:
  python3 server.py --token SECRET --public-port 8080 --tunnel-port 9000
  python3 server.py --token SECRET --public-port 443 --tunnel-port 8443 \
      --public-tls-cert fullchain.pem --public-tls-key privkey.pem \
      --tunnel-tls-cert fullchain.pem --tunnel-tls-key privkey.pem

Routing:
  --route app.example.com=web:127.0.0.1:3000
  --route api.example.com=web:127.0.0.1:8000

The route target is informational and sent to the selected local connector.
The local connector decides which local service to open.
"""

import argparse
import asyncio
import base64
import hashlib
import hmac
import json
import os
import secrets
import signal
import ssl
import struct
import time
from dataclasses import dataclass, field
from typing import Dict, Optional, List, Tuple


# ---------------- Protocol ----------------

AUTH = 1
AUTH_OK = 2
OPEN = 3
OPEN_OK = 4
DATA = 5
CLOSE = 6
PING = 7
PONG = 8
ERROR = 9
REGISTER = 10
REGISTER_OK = 11

MAGIC = b"RTUN1"
HEADER = "!5sBII"
HEADER_SIZE = struct.calcsize(HEADER)
MAX_FRAME = 16 * 1024 * 1024
READ_CHUNK = 128 * 1024


def pack_frame(kind: int, stream_id: int, payload: bytes = b"") -> bytes:
    if len(payload) > MAX_FRAME:
        raise ValueError("payload too large")
    return struct.pack(HEADER, MAGIC, kind, stream_id, len(payload)) + payload


async def read_frame(reader: asyncio.StreamReader):
    header = await reader.readexactly(HEADER_SIZE)
    magic, kind, stream_id, length = struct.unpack(HEADER, header)
    if magic != MAGIC:
        raise ValueError("invalid tunnel protocol")
    if length > MAX_FRAME:
        raise ValueError("frame too large")
    payload = await reader.readexactly(length)
    return kind, stream_id, payload


def jb(obj) -> bytes:
    return json.dumps(obj, separators=(",", ":")).encode()


def jo(data: bytes) -> dict:
    try:
        return json.loads(data.decode())
    except Exception:
        return {}


def token_ok(given: str, expected: str) -> bool:
    return hmac.compare_digest(given.encode(), expected.encode())


def client_key(client_id: str, secret: str) -> str:
    return hashlib.sha256(
        (client_id + ":" + secret).encode()
    ).hexdigest()


# ---------------- Routing ----------------

@dataclass
class Route:
    hostname: str
    service: str
    local_host: str
    local_port: int


def parse_route(value: str) -> Route:
    # hostname=service:host:port OR hostname=host:port
    if "=" not in value:
        raise ValueError("route must be hostname=[service:]host:port")
    hostname, rhs = value.split("=", 1)
    parts = rhs.rsplit(":", 2)
    if len(parts) == 3:
        service, host, port = parts
    elif len(parts) == 2:
        service = "web"
        host, port = parts
    else:
        raise ValueError("route target must be [service:]host:port")
    return Route(
        hostname=hostname.lower().rstrip("."),
        service=service,
        local_host=host,
        local_port=int(port),
    )


# ---------------- Tunnel connector ----------------

class Connector:
    def __init__(self, server, reader, writer, client_id, connector_id):
        self.server = server
        self.reader = reader
        self.writer = writer
        self.client_id = client_id
        self.connector_id = connector_id
        self.last_seen = time.monotonic()
        self.streams: Dict[int, asyncio.StreamWriter] = {}
        self.write_lock = asyncio.Lock()
        self.closed = False
        self.hello = {}

    @property
    def key(self):
        return f"{self.client_id}/{self.connector_id}"

    async def send(self, kind, stream_id=0, payload=b""):
        if self.closed:
            return
        async with self.write_lock:
            try:
                self.writer.write(pack_frame(kind, stream_id, payload))
                await self.writer.drain()
            except Exception:
                await self.close()

    async def close(self):
        if self.closed:
            return
        self.closed = True
        for w in list(self.streams.values()):
            try:
                w.close()
                await w.wait_closed()
            except Exception:
                pass
        self.streams.clear()
        try:
            self.writer.close()
            await self.writer.wait_closed()
        except Exception:
            pass
        self.server.remove_connector(self)

    def __repr__(self):
        return f"<Connector {self.key} streams={len(self.streams)}>"


# ---------------- Server ----------------

class ReverseTunnelServer:
    def __init__(self, args):
        self.args = args
        self.routes: Dict[str, Route] = {}
        for item in args.route:
            r = parse_route(item)
            self.routes[r.hostname] = r

        self.connectors: Dict[str, List[Connector]] = {}
        self.stream_owner: Dict[int, Connector] = {}
        self.public_streams: Dict[int, asyncio.StreamWriter] = {}
        self.next_stream = secrets.randbits(31) or 1
        self.conn_rr: Dict[str, int] = {}
        self.lock = asyncio.Lock()
        self.started = time.time()
        self.total_public = 0
        self.total_bytes = 0
        self.stop_event = asyncio.Event()
        self.tunnel_server = None
        self.public_server = None
        self.status_server = None

    def new_stream_id(self):
        self.next_stream = (self.next_stream + 1) & 0xFFFFFFFF
        if self.next_stream == 0:
            self.next_stream = 1
        return self.next_stream

    def add_connector(self, c: Connector):
        self.connectors.setdefault(c.client_id, []).append(c)
        print(f"[server] CONNECTOR + {c.key}")

    def remove_connector(self, c: Connector):
        arr = self.connectors.get(c.client_id, [])
        if c in arr:
            arr.remove(c)
        if not arr and c.client_id in self.connectors:
            del self.connectors[c.client_id]
        print(f"[server] CONNECTOR - {c.key}")

    def pick_connector(self, client_id: Optional[str] = None):
        candidates = []
        if client_id:
            candidates = list(self.connectors.get(client_id, []))
        else:
            for arr in self.connectors.values():
                candidates.extend(arr)

        candidates = [c for c in candidates if not c.closed]
        if not candidates:
            return None

        # least-streams + round-robin tie breaker
        return min(candidates, key=lambda c: len(c.streams))

    def find_route(self, hostname: str) -> Optional[Route]:
        hostname = hostname.lower().rstrip(".")
        if hostname in self.routes:
            return self.routes[hostname]
        # wildcard route: *.example.com
        best = None
        for key, route in self.routes.items():
            if key.startswith("*.") and hostname.endswith(key[1:]):
                if best is None or len(key) > len(best.hostname):
                    best = route
        return best

    async def authenticate(self, reader, writer):
        kind, sid, payload = await asyncio.wait_for(read_frame(reader), 15)
        if kind != AUTH:
            raise PermissionError("expected AUTH")
        msg = jo(payload)
        given = str(msg.get("token", ""))
        if not token_ok(given, self.args.token):
            raise PermissionError("bad token")
        client_id = str(msg.get("client_id", "")).strip() or "default"
        connector_id = str(msg.get("connector_id", "")).strip() or secrets.token_hex(8)
        if len(client_id) > 128 or len(connector_id) > 128:
            raise PermissionError("invalid client id")
        c = Connector(self, reader, writer, client_id, connector_id)
        c.hello = msg
        self.add_connector(c)
        await c.send(AUTH_OK, 0, jb({
            "client_id": client_id,
            "connector_id": connector_id,
            "server_time": time.time(),
            "routes": {
                k: {
                    "service": v.service,
                    "host": v.local_host,
                    "port": v.local_port,
                } for k, v in self.routes.items()
            },
        }))
        return c

    async def handle_tunnel(self, reader, writer):
        peer = writer.get_extra_info("peername")
        c = None
        try:
            c = await self.authenticate(reader, writer)
            await self.connector_loop(c)
        except asyncio.IncompleteReadError:
            # Clean disconnect by local client
            pass
        except ConnectionResetError:
            pass
        except Exception as e:
            print(f"[server] tunnel {peer}: {e}")
        finally:
            if c:
                await c.close()
            else:
                try:
                    writer.close()
                    await writer.wait_closed()
                except Exception:
                    pass

    async def connector_loop(self, c: Connector):
        while not c.closed:
            try:
                kind, sid, payload = await read_frame(c.reader)
            except (asyncio.IncompleteReadError, ConnectionResetError, BrokenPipeError):
                break
            c.last_seen = time.monotonic()

            if kind == REGISTER:
                info = jo(payload)
                await c.send(REGISTER_OK, 0, jb({"ok": True, "info": info}))

            elif kind == DATA:
                w = c.streams.get(sid)
                if w:
                    try:
                        w.write(payload)
                        await w.drain()
                        self.total_bytes += len(payload)
                    except Exception:
                        await self.close_stream(c, sid, notify=True)

            elif kind == OPEN_OK:
                pass

            elif kind == CLOSE:
                await self.close_stream(c, sid, notify=False)

            elif kind == PONG:
                pass

            elif kind == PING:
                await c.send(PONG, 0)

            elif kind == ERROR:
                print(f"[server] connector error {c.key}: {payload[:500]!r}")

    async def open_public_stream(self, reader, writer):
        connector = None
        sid = None
        try:
            if len(self.public_streams) >= self.args.max_streams:
                writer.write(b"HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n")
                await writer.drain()
                return

            # Peek enough bytes to extract HTTP Host without consuming permanently.
            try:
                initial = await asyncio.wait_for(reader.read(64 * 1024), self.args.request_timeout)
            except (asyncio.TimeoutError, TimeoutError):
                # Browser pre-connect or idle connection timed out
                return
            except (ConnectionResetError, BrokenPipeError, asyncio.IncompleteReadError):
                return

            if not initial:
                return

            hostname = self.extract_host(initial)
            route = self.find_route(hostname) if hostname else None

            connector = self.pick_connector()
            if not connector:
                writer.write(
                    b"HTTP/1.1 503 Service Unavailable\r\n"
                    b"Content-Type: text/plain\r\n"
                    b"Connection: close\r\n\r\n"
                    b"No local connector available.\n"
                )
                await writer.drain()
                return

            sid = self.new_stream_id()
            connector.streams[sid] = writer
            self.stream_owner[sid] = connector
            self.public_streams[sid] = writer
            self.total_public += 1

            route_info = None
            if route:
                route_info = {
                    "hostname": route.hostname,
                    "service": route.service,
                    "local_host": route.local_host,
                    "local_port": route.local_port,
                }

            await connector.send(
                OPEN,
                sid,
                jb({
                    "hostname": hostname,
                    "route": route_info,
                    "initial_bytes": base64.b64encode(initial).decode(),
                }),
            )

            try:
                while not writer.is_closing():
                    data = await reader.read(READ_CHUNK)
                    if not data:
                        break
                    await connector.send(DATA, sid, data)
                    self.total_bytes += len(data)
            except (ConnectionResetError, BrokenPipeError, asyncio.CancelledError):
                pass
            except Exception as e:
                print(f"[server] public stream {sid}: {e}")
            finally:
                if connector and sid:
                    await self.close_stream(connector, sid, notify=True)

        except Exception as e:
            pass
        finally:
            try:
                if not writer.is_closing():
                    writer.close()
                    await writer.wait_closed()
            except Exception:
                pass

    @staticmethod
    def extract_host(data: bytes) -> str:
        # HTTP Host header, supports host:port.
        try:
            text = data.decode("latin-1", "ignore")
            for line in text.split("\r\n"):
                if line.lower().startswith("host:"):
                    value = line[5:].strip()
                    if value.startswith("["):
                        end = value.find("]")
                        return value[1:end] if end > 0 else value
                    return value.split(":", 1)[0]
        except Exception:
            pass
        return ""

    async def close_stream(self, c: Connector, sid: int, notify=True):
        w = c.streams.pop(sid, None)
        self.stream_owner.pop(sid, None)
        self.public_streams.pop(sid, None)
        if notify and not c.closed:
            try:
                await c.send(CLOSE, sid)
            except Exception:
                pass
        if w:
            try:
                w.close()
                await w.wait_closed()
            except Exception:
                pass

    async def heartbeat(self):
        while not self.stop_event.is_set():
            await asyncio.sleep(self.args.heartbeat)
            for arr in list(self.connectors.values()):
                for c in list(arr):
                    try:
                        if time.monotonic() - c.last_seen > self.args.timeout:
                            print(f"[server] heartbeat timeout {c.key}")
                            await c.close()
                        else:
                            await c.send(PING, 0)
                    except Exception:
                        await c.close()

    async def status_handler(self, reader, writer):
        try:
            req = await asyncio.wait_for(reader.read(8192), 3)
            first = req.decode("latin-1", "ignore").split("\r\n", 1)[0]
            if first.startswith("GET /health"):
                body = json.dumps({
                    "ok": True,
                    "uptime": time.time() - self.started,
                    "clients": {
                        cid: len(arr) for cid, arr in self.connectors.items()
                    },
                    "routes": list(self.routes),
                    "public_connections": self.total_public,
                    "bytes": self.total_bytes,
                }).encode()
                resp = (
                    b"HTTP/1.1 200 OK\r\n"
                    b"Content-Type: application/json\r\n"
                    b"Content-Length: " + str(len(body)).encode() + b"\r\n"
                    b"Connection: close\r\n\r\n" + body
                )
            else:
                body = b"reverse tunnel server\n"
                resp = (
                    b"HTTP/1.1 404 Not Found\r\n"
                    b"Content-Length: " + str(len(body)).encode() +
                    b"\r\nConnection: close\r\n\r\n" + body
                )
            writer.write(resp)
            await writer.drain()
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass

    def make_ssl(self, cert, key):
        if not cert or not key:
            return None
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_2
        ctx.load_cert_chain(cert, key)
        return ctx

    async def start(self):
        tunnel_ssl = self.make_ssl(
            self.args.tunnel_tls_cert,
            self.args.tunnel_tls_key
        )
        public_ssl = self.make_ssl(
            self.args.public_tls_cert,
            self.args.public_tls_key
        )

        self.tunnel_server = await asyncio.start_server(
            self.handle_tunnel,
            self.args.tunnel_host,
            self.args.tunnel_port,
            ssl=tunnel_ssl,
            limit=2**20,
        )

        self.public_server = await asyncio.start_server(
            self.open_public_stream,
            self.args.public_host,
            self.args.public_port,
            ssl=public_ssl,
            limit=2**20,
        )

        if self.args.status_port:
            self.status_server = await asyncio.start_server(
                self.status_handler,
                self.args.status_host,
                self.args.status_port,
            )

        asyncio.create_task(self.heartbeat())

        print("================================================")
        print("  TWO-FILE REVERSE TUNNEL SERVER")
        print("================================================")
        print(f"Tunnel : {self.args.tunnel_host}:{self.args.tunnel_port}")
        print(f"Public : {self.args.public_host}:{self.args.public_port}")
        print(f"TLS tunnel : {bool(tunnel_ssl)}")
        print(f"TLS public : {bool(public_ssl)}")
        print(f"Routes : {len(self.routes)}")
        print(f"Max streams : {self.args.max_streams}")
        print("================================================")

        await self.stop_event.wait()

    async def shutdown(self):
        if self.stop_event.is_set():
            return
        self.stop_event.set()

        for arr in list(self.connectors.values()):
            for c in list(arr):
                await c.close()

        for s in (self.tunnel_server, self.public_server, self.status_server):
            if s:
                s.close()
                await s.wait_closed()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--token", default=os.environ.get("TUNNEL_TOKEN", "CHANGE_ME"))
    p.add_argument("--tunnel-host", default="0.0.0.0")
    p.add_argument("--tunnel-port", type=int, default=9000)
    p.add_argument("--public-host", default="0.0.0.0")
    p.add_argument("--public-port", type=int, default=8080)
    p.add_argument("--tunnel-tls-cert")
    p.add_argument("--tunnel-tls-key")
    p.add_argument("--public-tls-cert")
    p.add_argument("--public-tls-key")
    p.add_argument("--route", action="append", default=[],
                   help="hostname=service:host:port; repeatable")
    p.add_argument("--status-host", default="127.0.0.1")
    p.add_argument("--status-port", type=int, default=0)
    p.add_argument("--heartbeat", type=int, default=20)
    p.add_argument("--timeout", type=int, default=60)
    p.add_argument("--request-timeout", type=float, default=15)
    p.add_argument("--max-streams", type=int, default=10000)
    args = p.parse_args()

    if args.token == "CHANGE_ME":
        raise SystemExit("Set --token or TUNNEL_TOKEN to a strong random value.")

    async def runner():
        server = ReverseTunnelServer(args)
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(
                    sig,
                    lambda: asyncio.create_task(server.shutdown())
                )
            except NotImplementedError:
                pass
        await server.start()

    try:
        asyncio.run(runner())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
