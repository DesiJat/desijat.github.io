# 📖 Complete Commands & Parameter Reference (`commands.md`)

This reference document details all the commands, subcommands, arguments, and parameters used in the Python Reverse Tunnel project.

---

## 📑 Table of Contents
1. [⚡ Automation Controller Script (`run.sh`)](#1-⚡-automation-controller-script-runsh)
2. [🖥️ Reverse Tunnel Server (`server.py`)](#2-️-reverse-tunnel-server-serverpy)
3. [🔌 Local Client Connector (`local.py`)](#3--local-client-connector-localpy)
4. [🌐 Local HTTP Server (`http.server`)](#4--local-http-server-httpserver)
5. [🔑 SSL/TLS Certificate Generation (`openssl`)](#5--ssltls-certificate-generation-openssl)
6. [🧪 Testing & Verification (`curl`)](#6--testing--verification-curl)
7. [🔄 Process Management & Diagnostics (`ps`, `lsof`, `kill`, `tail`)](#7--process-management--diagnostics)

---

## 1. ⚡ Automation Controller Script (`run.sh`)

[`run.sh`](file:///Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy/run.sh) manages all services (Local HTTP, Tunnel Server, and Client Connector) in the background with auto-logging and health checks.

### 📌 Syntax
```bash
./run.sh <command>
# OR with custom environment variables:
VARIABLE=value ./run.sh <command>
```

### 📋 Available Subcommands

| Subcommand | Description |
| :--- | :--- |
| `start` / `up` | Frees ports, starts all 3 components in plain HTTP mode (`http://0.0.0.0:8080`), and tests endpoints. |
| `start-tls` / `tls` | Generates SSL certs (if missing) and starts all components in **SSL/TLS encrypted mode** (`https://0.0.0.0:8443`). |
| `certs` | Generates self-signed RSA 2048-bit SSL/TLS certificates into `./certs/cert.pem` and `./certs/key.pem`. |
| `stop` / `down` | Gracefully terminates all background services and frees ports (3000, 8080, 8443, 9000, 8081). |
| `restart` | Restarts all services. |
| `status` | Checks if services are running, displays their PIDs, and verifies port occupancy. |
| `test` | Probes direct local HTTP, proxied tunnel public endpoint, and LAN IP (auto-detects HTTP vs HTTPS). |
| `logs [service]` | Displays logs. Options: `server`, `local`, `http`, or `all` (default). |
| `help` | Prints the interactive usage guide and options. |

### ⚙️ Environment Variables / Parameters

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `TOKEN` | `MySecret123` | Authentication secret token shared between Server and Client. |
| `HTTP_PORT` | `3000` | Port of your local backend web application. |
| `PUBLIC_PORT` | `8080` (or `8443` for TLS) | Public listening port on the tunnel server for incoming user traffic. |
| `TUNNEL_PORT` | `9000` | Port where the client connector connects to the tunnel server. |
| `STATUS_PORT` | `8081` | Port where the server exposes JSON `/health` status endpoint. |
| `SERVER_HOST` | `127.0.0.1` | Target tunnel server host IP/domain for the client to connect to. |
| `ENABLE_TLS` | `false` | When set to `true`, enables TLS encryption on tunnel and public ports. |

### 💡 Examples
```bash
# Start standard HTTP
./run.sh start

# Start with custom token and public port
TOKEN="supersecret" PUBLIC_PORT=80 ./run.sh start

# Start with full SSL/TLS encryption
./run.sh start-tls

# Check status and test
./run.sh status
./run.sh test

# Stream server logs in real-time
./run.sh logs server

# Stop everything
./run.sh stop
```

---

## 2. 🖥️ Reverse Tunnel Server (`server.py`)

[`server.py`](file:///Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy/server.py) is the central multiplexing server. It receives public internet traffic and forwards it across the persistent reverse tunnel connection opened by `local.py`.

### 📌 Syntax
```bash
python3 server.py [OPTIONS]
```

### 📋 Parameter Reference

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--token` | `string` | `TUNNEL_TOKEN` env / `CHANGE_ME` | **Required**. Shared authentication token. |
| `--public-host` | `string` | `0.0.0.0` | Bind IP/interface for incoming public user traffic. |
| `--public-port` | `integer` | `8080` | Port on which public HTTP/HTTPS traffic is accepted. |
| `--tunnel-host` | `string` | `0.0.0.0` | Bind IP/interface for tunnel connections from local clients. |
| `--tunnel-port` | `integer` | `9000` | Port where local clients connect to establish the tunnel. |
| `--route` | `string` | `[]` | Hostname routing rule: `hostname=service:host:port`. Can be specified multiple times. |
| `--status-host` | `string` | `127.0.0.1` | Host interface for the status/health server. |
| `--status-port` | `integer` | `0` (disabled) | Port to expose `/health` JSON monitoring endpoint (e.g. `8081`). |
| `--heartbeat` | `integer` | `20` | Interval (in seconds) to send ping keepalive frames to clients. |
| `--timeout` | `integer` | `60` | Max seconds of inactivity before a client connector is disconnected. |
| `--request-timeout` | `float` | `15.0` | Max seconds to wait for initial HTTP request headers from public clients. |
| `--max-streams` | `integer` | `10000` | Maximum number of concurrent multiplexed TCP streams allowed. |
| `--tunnel-tls-cert` | `filepath` | `None` | Path to SSL/TLS certificate for the tunnel listener (port 9000). |
| `--tunnel-tls-key` | `filepath` | `None` | Path to SSL/TLS private key for the tunnel listener. |
| `--public-tls-cert` | `filepath` | `None` | Path to SSL/TLS certificate for the public HTTPS listener (port 8080/8443). |
| `--public-tls-key` | `filepath` | `None` | Path to SSL/TLS private key for the public HTTPS listener. |

### 💡 Examples
```bash
# 1. Basic Server
python3 server.py --token MySecret123 --public-port 8080 --tunnel-port 9000

# 2. Server with Health Monitoring
python3 server.py --token MySecret123 --public-port 8080 --tunnel-port 9000 --status-port 8081

# 3. Server with Hostname Routing (Multi-domain)
python3 server.py \
  --token MySecret123 \
  --public-port 80 \
  --tunnel-port 9000 \
  --route app.example.com=web:127.0.0.1:3000 \
  --route api.example.com=api:127.0.0.1:8000

# 4. Server with Full SSL/TLS (HTTPS on port 8443 + Encrypted Tunnel)
python3 server.py \
  --token MySecret123 \
  --public-port 8443 \
  --tunnel-port 9000 \
  --tunnel-tls-cert certs/cert.pem \
  --tunnel-tls-key certs/key.pem \
  --public-tls-cert certs/cert.pem \
  --public-tls-key certs/key.pem
```

---

## 3. 🔌 Local Client Connector (`local.py`)

[`local.py`](file:///Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy/local.py) runs locally behind NAT / firewalls. It connects outbound to the tunnel server and proxies multiplexed requests to your local backend application.

### 📌 Syntax
```bash
python3 local.py --server <HOST:PORT> --token <TOKEN> [OPTIONS]
```

### 📋 Parameter Reference

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `--server` | `string` | *(Required)* | Address of the remote tunnel server in `HOST:PORT` format (e.g. `10.40.194.136:9000`). |
| `--token` | `string` | *(Required)* | Secret token matching the server's `--token`. |
| `--local` | `string` | `None` | Target local service address in `HOST:PORT` format (e.g. `127.0.0.1:3000`). |
| `--route` | `string` | `[]` | Hostname routing rule: `hostname=HOST:PORT`. Can be specified multiple times. |
| `--connections` | `integer` | `4` | Number of parallel persistent tunnel connections for high availability (1..32). |
| `--client-id` | `string` | System hostname | Unique identifier for this client instance. |
| `--tls` | `flag` | `False` | Enable TLS encryption when connecting to the tunnel server. |
| `--insecure` | `flag` | `False` | Disable TLS certificate hostname and validity checks (for self-signed certs). |
| `--reconnect-max` | `integer` | `60` | Maximum backoff delay in seconds for automatic reconnection. |

### 💡 Examples
```bash
# 1. Basic Single Service
python3 local.py --server 127.0.0.1:9000 --token MySecret123 --local 127.0.0.1:3000

# 2. Connect to Remote Cloud / LAN Server
python3 local.py --server 10.40.194.136:9000 --token MySecret123 --local 127.0.0.1:3000

# 3. Multiple Local Services with Hostname Routing
python3 local.py \
  --server tunnel.example.com:9000 \
  --token MySecret123 \
  --route app.example.com=127.0.0.1:3000 \
  --route api.example.com=127.0.0.1:8000

# 4. Encrypted TLS Tunnel Connection (Self-Signed)
python3 local.py \
  --server 127.0.0.1:9000 \
  --token MySecret123 \
  --tls \
  --insecure \
  --local 127.0.0.1:3000

# 5. High Availability (8 Parallel Multiplexed Connections)
python3 local.py \
  --server 127.0.0.1:9000 \
  --token MySecret123 \
  --connections 8 \
  --local 127.0.0.1:3000
```

---

## 4. 🌐 Local HTTP Server (`http.server`)

Python's built-in module used to serve local files and web pages for testing.

### 📌 Syntax
```bash
python3 -m http.server [PORT] [OPTIONS]
```

### 📋 Parameter Reference

| Parameter | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `[PORT]` | `integer` | `8000` | Port number to bind the HTTP server to (e.g. `3000`). |
| `--bind` / `-b` | `string` | `0.0.0.0` / `::` | Specific IP address to bind to (e.g. `127.0.0.1`). |
| `--directory` / `-d` | `path` | Current working dir | Directory path from which to serve files. |
| `-u` (Python flag) | `flag` | `False` | Force unbuffered standard output for immediate logging. |

### 💡 Examples
```bash
# Serve current directory on port 3000
python3 -m http.server 3000

# Serve specific directory on localhost only
python3 -m http.server 3000 --bind 127.0.0.1 --directory /path/to/web

# Run in background with unbuffered logging
nohup python3 -u -m http.server 3000 > http.log 2>&1 &
```

---

## 5. 🔑 SSL/TLS Certificate Generation (`openssl`)

Commands to create self-signed SSL/TLS certificates for testing encrypted tunnels and HTTPS endpoints.

### 📌 Command
```bash
mkdir -p certs && openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/key.pem -out certs/cert.pem -days 365 \
  -subj "/CN=127.0.0.1"
```

### 📋 Parameter Reference

| Parameter | Description |
| :--- | :--- |
| `req` | OpenSSL PKCS#10 X.509 Certificate Signing Request (CSR) management. |
| `-x509` | Output a self-signed certificate instead of a certificate signing request. |
| `-newkey rsa:2048` | Generate a new RSA private key of 2048 bits. |
| `-nodes` | No DES encryption (do not encrypt the private key with a password passphrase). |
| `-keyout <path>` | Filepath where the private key will be saved (`certs/key.pem`). |
| `-out <path>` | Filepath where the certificate will be saved (`certs/cert.pem`). |
| `-days <number>` | Number of days the certificate is valid for (`365`). |
| `-subj "/CN=..."` | Subject Common Name (e.g. `/CN=127.0.0.1` or `/CN=localhost`). |

---

## 6. 🧪 Testing & Verification (`curl`)

Commands to test HTTP, HTTPS, and reverse tunnel connectivity.

### 📋 Useful `curl` Flags

| Flag | Description |
| :--- | :--- |
| `-i` / `--include` | Include HTTP response headers in the output. |
| `-I` / `--head` | Fetch and display only HTTP headers (HEAD request). |
| `-s` / `--silent` | Silent mode; suppress progress meter and error messages. |
| `-k` / `--insecure` | Allow insecure SSL connections (skip certificate verification for self-signed certs). |
| `-o <file>` | Write response body to a file instead of stdout (e.g. `-o /dev/null`). |
| `-w <format>` | Custom format string to display (e.g. `-w "%{http_code}"` to print only HTTP status). |

### 💡 Examples
```bash
# 1. Test local backend directly
curl -i http://127.0.0.1:3000/health.json

# 2. Test via public reverse tunnel port (HTTP)
curl -i http://127.0.0.1:8080/health.json

# 3. Test via LAN IP address
curl -i http://10.40.194.136:8080/health.json

# 4. Test via encrypted HTTPS tunnel port
curl -k -i https://127.0.0.1:8443/health.json

# 5. Query server health endpoint
curl http://127.0.0.1:8081/health

# 6. Check HTTP status code only
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/health.json
```

---

## 7. 🔄 Process Management & Diagnostics

Commands to inspect, monitor, and terminate background processes.

### 📋 Commands & Flags Reference

| Task | Command | Description |
| :--- | :--- | :--- |
| **Check Port Occupancy** | `lsof -i :3000 -i :8080 -i :9000` | Lists all processes listening or connected to specified ports. |
| **Get Port PIDs** | `lsof -t -i :3000 -i :8080 -i :9000` | Outputs only the numerical PIDs using the ports. |
| **Find Running Processes** | `ps aux \| grep -E "server.py\|local.py\|http.server"` | Displays active Python processes with their arguments. |
| **Kill by Process Name** | `pkill -f "python3 server.py"` | Sends `SIGTERM` to any process matching the command string. |
| **Kill by Ports** | `kill -9 $(lsof -t -i :3000 -i :8080 -i :9000)` | Force-kills (`SIGKILL`) any process bound to the listed ports. |
| **Kill by PID** | `kill -9 <PID>` | Force-kills a specific process ID. |
| **Real-time Log Follow** | `tail -f logs/server.log` | Streams new lines appended to the log file in real-time. |
| **Inspect Last N Lines** | `tail -n 20 logs/local.log` | Shows the last 20 lines of the log file. |
