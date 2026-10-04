#!/usr/bin/env python3
"""
local.py - two-file reverse tunnel connector.

Features:
- outbound-only persistent tunnel
- multiple parallel tunnel connections
- automatic reconnect with exponential backoff
- local service routing
- HTTP Host routing
- HTTPS/TCP passthrough
- TLS tunnel support
- multiple local services
- heartbeat
- standard library only

Examples:

python3 local.py --server 10.40.194.136:9000 --token SECRET \
    --local 127.0.0.1:3000

Single service:
  python3 local.py --server example.com:9000 --token SECRET \
      --local 127.0.0.1:3000

TLS tunnel:
  python3 local.py --server example.com:8443 --token SECRET \
      --tls --local 127.0.0.1:3000

Multiple services:
  python3 local.py --server example.com:9000 --token SECRET \
      --route app.example.com=127.0.0.1:3000 \
      --route api.example.com=127.0.0.1:8000

High availability:
  --connections 4
"""

import argparse
import asyncio
import base64
import json
import os
import random
import signal
import socket
import ssl
import struct
import time
import uuid
from typing import Dict, Tuple


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


def pack_frame(kind, sid, payload=b""):
    return struct.pack(
        HEADER, MAGIC, kind, sid, len(payload)
    ) + payload


async def read_frame(reader):
    header = await reader.readexactly(HEADER_SIZE)
    magic, kind, sid, length = struct.unpack(HEADER, header)
    if magic != MAGIC:
        raise ValueError("invalid tunnel protocol")
    if length > MAX_FRAME:
        raise ValueError("frame too large")
    payload = await reader.readexactly(length)
    return kind, sid, payload


def jb(obj):
    return json.dumps(obj, separators=(",", ":")).encode()


def jo(data):
    try:
        return json.loads(data.decode())
    except Exception:
        return {}


# ---------------- Local routing ----------------

def parse_route(value):
    # hostname=127.0.0.1:3000 or hostname=web:127.0.0.1:3000
    if "=" not in value:
        raise ValueError("local route must be hostname=host:port")
    host, target = value.split("=", 1)
    parts = target.rsplit(":", 2)
    if len(parts) == 3:
        _, h, p = parts
    elif len(parts) == 2:
        h, p = parts
    else:
        raise ValueError("local route target must be [service:]host:port")
    return host.lower().rstrip("."), (h, int(p))


class Connector:
    def __init__(
        self,
        app,
        index,
        server_host,
        server_port,
        token,
        client_id,
        tls,
        insecure,
        default_local,
        routes,
        reconnect_max,
    ):
        self.app = app
        self.index = index
        self.server_host = server_host
        self.server_port = server_port
        self.token = token
        self.client_id = client_id
        self.connector_id = f"{client_id}-{index}-{uuid.uuid4().hex[:10]}"
        self.tls = tls
        self.insecure = insecure
        self.default_local = default_local
        self.routes = routes
        self.reconnect_max = reconnect_max

        self.reader = None
        self.writer = None
        self.write_lock = None
        self.streams: Dict[int, Tuple[asyncio.StreamReader, asyncio.StreamWriter]] = {}
        self.closed = False

    def route_for(self, hostname):
        hostname = (hostname or "").lower().rstrip(".")
        if hostname in self.routes:
            return self.routes[hostname]
        best = None
        for key, value in self.routes.items():
            if key.startswith("*.") and hostname.endswith(key[1:]):
                if best is None or len(key) > len(best[0]):
                    best = (key, value)
        if best:
            return best[1]
        return self.default_local

    async def send(self, kind, sid=0, payload=b""):
        if not self.writer or self.writer.is_closing():
            raise ConnectionError("tunnel not connected")
        async with self.write_lock:
            self.writer.write(pack_frame(kind, sid, payload))
            await self.writer.drain()

    def ssl_context(self):
        if not self.tls:
            return None
        ctx = ssl.create_default_context()
        if self.insecure:
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
        return ctx

    async def connect(self):
        ctx = self.ssl_context()
        self.reader, self.writer = await asyncio.open_connection(
            self.server_host,
            self.server_port,
            ssl=ctx,
            server_hostname=None if self.insecure else self.server_host if ctx else None,
        )
        self.write_lock = asyncio.Lock()

        await self.send(
            AUTH,
            0,
            jb({
                "token": self.token,
                "client_id": self.client_id,
                "connector_id": self.connector_id,
                "protocol": "RTUN1",
                "capabilities": [
                    "multiplex",
                    "http",
                    "https",
                    "tcp",
                    "websocket",
                ],
            }),
        )

        kind, sid, payload = await asyncio.wait_for(
            read_frame(self.reader), 15
        )
        if kind != AUTH_OK:
            raise ConnectionError("authentication rejected")

        info = jo(payload)
        print(
            f"[local:{self.index}] connected "
            f"client={info.get('client_id')} "
            f"connector={info.get('connector_id')}"
        )

        # Register local route table.
        await self.send(
            REGISTER,
            0,
            jb({
                "routes": {
                    k: {
                        "host": v[0],
                        "port": v[1]
                    } for k, v in self.routes.items()
                },
                "default": {
                    "host": self.default_local[0],
                    "port": self.default_local[1]
                },
            }),
        )

    async def open_local(self, sid, payload):
        info = jo(payload)
        hostname = info.get("hostname", "")
        target = self.route_for(hostname)

        # If the server route explicitly contains a local target,
        # prefer the local route table; otherwise use default.
        if not target:
            await self.send(ERROR, sid, b"no local service configured")
            await self.send(CLOSE, sid)
            return

        host, port = target
        try:
            reader, writer = await asyncio.open_connection(host, port)
        except Exception as e:
            await self.send(ERROR, sid, str(e).encode()[:4096])
            await self.send(CLOSE, sid)
            return

        self.streams[sid] = (reader, writer)

        # The server already forwarded the initial public request.
        initial = info.get("initial_bytes")
        if initial:
            try:
                writer.write(base64.b64decode(initial))
                await writer.drain()
            except Exception:
                await self.close_local(sid)
                return

        await self.send(OPEN_OK, sid)

        asyncio.create_task(self.local_to_tunnel(sid, reader))

    async def local_to_tunnel(self, sid, reader):
        try:
            while True:
                data = await reader.read(READ_CHUNK)
                if not data:
                    break
                await self.send(DATA, sid, data)
        except Exception:
            pass
        finally:
            await self.send(CLOSE, sid)
            await self.close_local(sid)

    async def tunnel_to_local(self, sid, data):
        item = self.streams.get(sid)
        if not item:
            return
        reader, writer = item
        try:
            writer.write(data)
            await writer.drain()
        except Exception:
            await self.close_local(sid)

    async def close_local(self, sid):
        item = self.streams.pop(sid, None)
        if item:
            _, writer = item
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def loop(self):
        while self.app.running:
            try:
                await self.connect()
                backoff = 1

                while self.app.running:
                    kind, sid, payload = await read_frame(self.reader)

                    if kind == OPEN:
                        await self.open_local(sid, payload)

                    elif kind == DATA:
                        await self.tunnel_to_local(sid, payload)

                    elif kind == CLOSE:
                        await self.close_local(sid)

                    elif kind == PING:
                        await self.send(PONG, 0)

                    elif kind == PONG:
                        pass

                    elif kind == REGISTER_OK:
                        pass

                    elif kind == ERROR:
                        print(
                            f"[local:{self.index}] server error: "
                            f"{payload[:500]!r}"
                        )

            except Exception as e:
                if self.app.running:
                    print(
                        f"[local:{self.index}] disconnected: {e}"
                    )

            finally:
                for sid in list(self.streams):
                    await self.close_local(sid)
                if self.writer:
                    try:
                        self.writer.close()
                        await self.writer.wait_closed()
                    except Exception:
                        pass
                self.writer = None
                self.reader = None

            if not self.app.running:
                break

            # Jitter avoids all replicas reconnecting simultaneously.
            delay = min(backoff, self.reconnect_max)
            delay += random.random() * min(1.0, delay / 3)
            print(
                f"[local:{self.index}] reconnecting in {delay:.1f}s"
            )
            await asyncio.sleep(delay)
            backoff = min(backoff * 2, self.reconnect_max)


class LocalApp:
    def __init__(self, args):
        self.args = args
        self.running = True
        self.routes = {}

        for item in args.route:
            host, target = parse_route(item)
            self.routes[host] = target

        default = args.local
        if not default:
            if not self.routes:
                raise SystemExit("Set --local or at least one --route.")
            default = next(iter(self.routes.values()))

        self.default_local = default
        self.connectors = []

    async def run(self):
        for i in range(self.args.connections):
            c = Connector(
                app=self,
                index=i + 1,
                server_host=self.args.server_host,
                server_port=self.args.server_port,
                token=self.args.token,
                client_id=self.args.client_id,
                tls=self.args.tls,
                insecure=self.args.insecure,
                default_local=self.default_local,
                routes=self.routes,
                reconnect_max=self.args.reconnect_max,
            )
            self.connectors.append(c)

        await asyncio.gather(
            *(c.loop() for c in self.connectors)
        )

    def stop(self):
        self.running = False


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--server", required=True,
                   help="SERVER:PORT")
    p.add_argument("--token", required=True)
    p.add_argument("--client-id", default=os.environ.get(
        "TUNNEL_CLIENT_ID", socket.gethostname()))
    p.add_argument("--local",
                   help="default local service HOST:PORT")
    p.add_argument("--route", action="append", default=[],
                   help="hostname=HOST:PORT; repeatable")
    p.add_argument("--connections", type=int, default=4,
                   help="persistent tunnel connections")
    p.add_argument("--tls", action="store_true")
    p.add_argument("--insecure", action="store_true",
                   help="disable TLS certificate verification")
    p.add_argument("--reconnect-max", type=int, default=60)
    args = p.parse_args()

    if ":" not in args.server:
        raise SystemExit("--server must be HOST:PORT")

    args.server_host, port = args.server.rsplit(":", 1)
    args.server_port = int(port)

    if args.local:
        if ":" not in args.local:
            raise SystemExit("--local must be HOST:PORT")
        h, p0 = args.local.rsplit(":", 1)
        args.local = (h, int(p0))
    else:
        args.local = None

    if args.connections < 1 or args.connections > 32:
        raise SystemExit("--connections must be 1..32")

    app = LocalApp(args)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, app.stop)
        except NotImplementedError:
            pass

    try:
        loop.run_until_complete(app.run())
    except KeyboardInterrupt:
        pass
    finally:
        loop.close()


if __name__ == "__main__":
    main()
