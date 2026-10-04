# 🚀 Python Reverse Tunnel (Cloudflare Tunnel Alternative)

A lightweight, zero-dependency reverse tunnel system built with pure Python (`asyncio` standard library). It allows you to expose local services running behind NAT or firewalls to the public internet or across networks via an outbound-only connection, similar to Cloudflare Tunnels or ngrok.

---

## 📐 Architecture

```text
+-----------------------+              +-----------------------------+              +-----------------------+              +--------------------+
|     Public User /     |              |     Reverse Tunnel Server   |              |     Local Connector   |              |   Local Service    |
|        Browser        |  =========>  |         (server.py)         |  <=========  |       (local.py)      |  =========>  | (e.g. Port 3000)   |
|                       |  HTTP/HTTPS  |                             |  Multiplexed |                       |  Local HTTP  |                    |
| curl host:8080        |              | Public Port: 8080           | Outbound TCP | Connects to 9000      |              |                    |
+-----------------------+              | Tunnel Port: 9000           |  (Token Auth)| Forwards to 127.0.0.1 |              +--------------------+
                                       +-----------------------------+              +-----------------------+
```

1. **Local Connector (`local.py`)** makes an **outbound-only TCP connection** to the **Tunnel Server (`server.py`)** on port 9000 with a shared secret token. No inbound ports need to be opened on your local machine or firewall.
2. **Public Server (`server.py`)** listens on public port 8080 for incoming HTTP requests.
3. When a public request arrives, `server.py` multiplexes the stream over the existing tunnel to `local.py`.
4. `local.py` forwards the stream to your local service (e.g. `127.0.0.1:3000`) and streams the response back.

---

## 📁 File Structure

| File | Description |
| :--- | :--- |
| [`server.py`](file:///Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy/server.py) | Central reverse tunnel server. Listens for public traffic and manages tunnel connections from local clients. |
| [`local.py`](file:///Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy/local.py) | Local connector client. Runs locally next to your service, establishes the outbound tunnel, and proxies traffic. |
| [`run.sh`](file:///Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy/run.sh) | All-in-one automation script to start, stop, restart, monitor, and test services. |
| [`commands.md`](file:///Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy/commands.md) | Complete reference for all commands, parameters, options, and flags. |
| [`index.html`](file:///Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy/index.html) | Sample web UI / test page. |
| [`readme.md`](file:///Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy/readme.md) | Complete documentation and usage guide. |

## ⚡ One-Click Automation (`run.sh`)

You can manage all services automatically with the included [`run.sh`](file:///Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy/run.sh) script:

```bash
cd '/Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy'

# 1. Start in standard HTTP mode (HTTP server + Tunnel Server + Local Client)
./run.sh start

# 2. OR Start in SSL/TLS Encrypted Mode (HTTPS on port 8443 + Encrypted Tunnel)
./run.sh start-tls

# 3. Generate self-signed SSL/TLS certificates into ./certs/
./run.sh certs

# 4. Check running status & port health
./run.sh status

# 5. Test endpoints (Auto-detects HTTP vs HTTPS)
./run.sh test

# 6. View real-time logs
./run.sh logs server   # or 'local', 'http', 'all'

# 7. Stop and kill all background processes cleanly
./run.sh stop
```

---

## ⚡ Manual Quick Start (Step-by-Step)

Open 3 terminal windows or tabs to run the flow:

### 1️⃣ Start your Local Service
Run any local web server or application you want to expose (e.g. Python's built-in HTTP server):
```bash
cd '/Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy'
python3 -m http.server 3000
```
> Serving locally on `http://127.0.0.1:3000`.

---

### 2️⃣ Start the Tunnel Server
Start the central server that will receive public traffic on port `8080` and accept tunnel client connections on port `9000`:
```bash
cd '/Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy'
python3 server.py --token SECRET --public-port 8080 --tunnel-port 9000
```

---

### 3️⃣ Start the Local Client Connector
Start the local connector to bridge your local service (`127.0.0.1:3000`) to the server:

**For Local / Same-Machine Testing:**
```bash
cd '/Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy'
python3 local.py --server 127.0.0.1:9000 --token SECRET --local 127.0.0.1:3000
```

**For Remote / LAN Server:**
```bash
cd '/Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy'
python3 local.py --server 10.40.194.136:9000 --token SECRET --local 127.0.0.1:3000
```

---

### 4️⃣ Test & Verify
Send a request to the public port (`8080`) on your server:

```bash
# Test locally
curl http://127.0.0.1:8080

# Or test via server IP address / domain
curl http://10.40.194.136:8080
```
You will receive the response served from your local HTTP server on port 3000!

---

## 🛠 Command-Line Reference

### `server.py` Options

| Flag | Default | Description |
| :--- | :--- | :--- |
| `--token` | `TUNNEL_TOKEN` env | Authentication secret token shared with clients (*required*). |
| `--public-host` | `0.0.0.0` | IP/Interface for public traffic listener. |
| `--public-port` | `8080` | Port for incoming public HTTP/TCP requests. |
| `--tunnel-host` | `0.0.0.0` | IP/Interface for tunnel listener. |
| `--tunnel-port` | `9000` | Port where local connector clients connect. |
| `--route` | `[]` | Hostname routing rule: `hostname=service:host:port` (can be repeated). |
| `--status-port` | `0` (disabled) | Port to expose `/health` JSON status endpoint (e.g. `8081`). |
| `--heartbeat` | `20` | Interval in seconds for tunnel ping/pong keepalive. |
| `--timeout` | `60` | Client inactivity timeout before disconnect. |
| `--max-streams` | `10000` | Maximum number of concurrent multiplexed TCP streams. |
| `--tunnel-tls-cert` | `None` | Certificate path for TLS encrypted tunnel. |
| `--tunnel-tls-key` | `None` | Private key path for TLS encrypted tunnel. |
| `--public-tls-cert` | `None` | Certificate path for public HTTPS listener. |
| `--public-tls-key` | `None` | Private key path for public HTTPS listener. |

---

### `local.py` Options

| Flag | Default | Description |
| :--- | :--- | :--- |
| `--server` | *(Required)* | Remote tunnel server address `HOST:PORT` (e.g. `10.40.194.136:9000`). |
| `--token` | *(Required)* | Authentication token matching server `--token`. |
| `--local` | `None` | Default local service to forward to `HOST:PORT` (e.g. `127.0.0.1:3000`). |
| `--route` | `[]` | Hostname-specific route: `hostname=HOST:PORT` (can be repeated). |
| `--connections` | `4` | Number of parallel persistent tunnel connections for high concurrency. |
| `--client-id` | `hostname` | Unique identifier for this client instance. |
| `--tls` | `False` | Enable TLS encryption when connecting to tunnel server. |
| `--insecure` | `False` | Disable TLS certificate verification (useful for self-signed certs). |
| `--reconnect-max` | `60` | Maximum reconnect backoff delay in seconds. |

---

## 💡 Practical Examples

### Example 1: Expose Multiple Local Services with Subdomain Routing

Route different hostnames to different local services through a single tunnel server:

**1. Server:**
```bash
python3 server.py \
  --token MySecret123 \
  --public-port 80 \
  --tunnel-port 9000 \
  --route app.example.com=web:127.0.0.1:3000 \
  --route api.example.com=api:127.0.0.1:8000
```

**2. Local Client:**
```bash
python3 local.py \
  --server tunnel.example.com:9000 \
  --token MySecret123 \
  --route app.example.com=127.0.0.1:3000 \
  --route api.example.com=127.0.0.1:8000
```

---

### Example 2: Health Monitoring Endpoint

Enable status inspection to monitor connected clients and active streams:

**1. Server:**
```bash
python3 server.py --token SECRET --public-port 8080 --tunnel-port 9000 --status-port 8081
```

**2. Query Status:**
```bash
curl http://127.0.0.1:8081/health
```
**Example Response:**
```json
{
  "ok": true,
  "uptime": 142.5,
  "clients": {
    "MacBook-Pro": 4
  },
  "routes": [],
  "public_connections": 12,
  "bytes": 542190
}
```

---

### Example 3: Encrypted Tunnel with TLS / HTTPS

Secure the tunnel connection between the client and server using SSL/TLS, and serve public HTTPS:

**1. Generate Self-Signed Certificates (or use `./run.sh certs`):**
```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/key.pem -out certs/cert.pem -days 365 \
  -subj "/CN=127.0.0.1"
```

**2. Start Server with TLS:**
```bash
python3 server.py \
  --token SECRET \
  --public-port 8443 \
  --tunnel-port 9000 \
  --tunnel-tls-cert certs/cert.pem \
  --tunnel-tls-key certs/key.pem \
  --public-tls-cert certs/cert.pem \
  --public-tls-key certs/key.pem
```

**3. Start Local Client with TLS:**
```bash
python3 local.py \
  --server 127.0.0.1:9000 \
  --token SECRET \
  --tls \
  --insecure \
  --local 127.0.0.1:3000
```

**4. Test HTTPS:**
```bash
curl -k https://127.0.0.1:8443/health.json
```

---

## 🔄 Running in the Background & Process Management

If you want to keep the services running in the background without keeping terminal windows open:

### 1️⃣ Start in Background (with Logging)

Use `nohup` or `&` with output redirected to log files:

**Start Local HTTP Server in background:**
```bash
nohup python3 -m http.server 3000 > http.log 2>&1 &
```

**Start Tunnel Server in background:**
```bash
nohup python3 server.py --token SECRET --public-port 8080 --tunnel-port 9000 > server.log 2>&1 &
```

**Start Local Client in background:**
```bash
nohup python3 local.py --server 127.0.0.1:9000 --token SECRET --local 127.0.0.1:3000 > local.log 2>&1 &
```

---

### 2️⃣ Check & Monitor Running Processes

**Check by Process List:**
```bash
ps aux | grep -E "server.py|local.py|http.server" | grep -v grep
```

**Check by Port Listening Status:**
```bash
# Check if ports 3000, 8080, and 9000 are active
lsof -i :3000 -i :8080 -i :9000
```

**View Live Logs:**
```bash
# Watch server logs in real time
tail -f server.log

# Watch local connector logs in real time
tail -f local.log
```

---

### 3️⃣ Stop / Kill Background Processes

**Option A: Kill by Process Name (Recommended)**
```bash
pkill -f "python3 server.py"
pkill -f "python3 local.py"
pkill -f "python3 -m http.server 3000"
```

**Option B: Kill by Port Numbers**
```bash
# Kill whatever process is occupying ports 3000, 8080, or 9000
kill -9 $(lsof -t -i :3000 -i :8080 -i :9000)
```

**Option C: Kill by PID (Process ID)**
```bash
# Find PID from ps or lsof, then kill:
kill <PID>
```


