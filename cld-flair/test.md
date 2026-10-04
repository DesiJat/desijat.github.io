```bash
# 1. One-click Plain HTTP
chmod +x run.sh && ./run.sh start
./run.sh status
./run.sh test
./run.sh stop

# 2. One-click SSL/TLS Encrypted Mode (HTTPS)
./run.sh start-tls
./run.sh status
./run.sh test
./run.sh stop
```

# create ssl files
```bash
# check version
openssl version
# check files
ls -la certs
# create files
mkdir -p certs && openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/key.pem -out certs/cert.pem -days 365 -subj "/CN=127.0.0.1"
```
# 

**1. Server:**
```bash
MY_TOKEN="MySecret123"
python3 server.py \
  --token $MY_TOKEN \
  --public-port 80 \
  --tunnel-port 9000 \
  --route app.example.com=web:127.0.0.1:3000 \
  --route api.example.com=api:127.0.0.1:8000
```

**2. Local Client:**
```bash
MY_TOKEN="MySecret123"

python3 local.py \
  --server tunnel.example.com:9000 \
  --token $MY_TOKEN \
  --route app.example.com=127.0.0.1:3000 \
  --route api.example.com=127.0.0.1:8000
```

```bash
curl http://[IP_ADDRESS]/health.json
```

```bash
cd '/Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy'
python3 server.py --token MySecret123 --tunnel-port 9000 --public-port 8080
python3 local.py --server 10.40.194.136:9000 --token MySecret123 --local 127.0.0.1:3000
http://10.40.194.136:8080

lsof -i :8080 -i :9000
lsof -t -i :8080 -i :9000
kill -9 $(lsof -t -i :8080 -i :9000)

python3 server.py --token MySecret123 --public-port 8080 --tunnel-port 9000
python3 local.py --server 127.0.0.1:9000 --token MySecret123 --route monu.zetameld.com=127.0.0.1:3000
curl -i -H "Host: monu.zetameld.com" http://127.0.0.1:8080/health.json
curl -i -H "Host: other.domain.com" http://127.0.0.1:8080/health.json
```

# <========> new test <========>

```bash
cd '/Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy'
python3 server.py --token MySecret123 --tunnel-port 9000 --public-port 8080
python3 local.py --server 10.40.194.136:9000 --token MySecret123 --local 127.0.0.1:3000
http://10.40.194.136:8080

lsof -t -i :4001 -i :4002 -i :4003
kill -9 $(lsof -t -i :4001 -i :4002)

cd '/root/experiment/cld'
python3 server.py --token MySecret123 --tunnel-port 4001 --public-port 4002
python3 local.py --server 187.127.130.132:4001 --token MySecret123 --local 127.0.0.1:3000
http://187.127.130.132:4002

# test for domain
# **Test B: When using a real domain (`monu.zetameld.com`):**
# 1. In your DNS settings for `zetameld.com`, add an `A` record:
#    - **Name:** `monu` (or `*.zetameld.com` for wildcards)
#    - **Value:** `YOUR_SERVER_PUBLIC_IP`
python3 local.py --server 187.127.130.132:4001 --token MySecret123 --route monu.zetameld.com=127.0.0.1:3000
curl http://monu.zetameld.com:4002/health.json
```



Ran command: `python3 -m http.server 3000`
Ran command: `python3 server.py --token MySecret123 --public-port 8080 --tunnel-port 9000`
Ran command: `python3 local.py --server 127.0.0.1:9000 --token MySecret123 --route monu.zetameld.com=127.0.0.1:3000`

Ran command: `curl -i -H "Host: monu.zetameld.com" http://127.0.0.1:8080/health.json`
Ran command: `curl -i -H "Host: other.domain.com" http://127.0.0.1:8080/health.json`





### 3. Step-by-Step: How to Use & Test Domain Routing

Domain routing works by inspecting the incoming HTTP `Host:` header (e.g. `Host: monu.zetameld.com`).

#### Step 1: Start your local backend (e.g. on port 3000)
```bash
cd /Users/apple/data/code/ai-library/pythonGateway/Cloudflare/testpy
python3 -m http.server 3000
```

#### Step 2: Start the Tunnel Server (on your public server / local machine)
```bash
python3 server.py --token MySecret123 --public-port 8080 --tunnel-port 9000
```

#### Step 3: Start the Local Connector with Domain Routing
```bash
python3 local.py \
  --server 127.0.0.1:9000 \
  --token MySecret123 \
  --route monu.zetameld.com=127.0.0.1:3000
```

#### Step 4: Test Domain Routing

**Test A: Direct domain simulation via `Host:` header:**
```bash
curl -i -H "Host: monu.zetameld.com" http://127.0.0.1:8080/health.json
curl -i -H "Host: monu.zetameld.com" http://187.127.130.132:4002/health.json
```
*(Returns `HTTP 200 OK` from your local port 3000!)*

**Test B: When using a real domain (`monu.zetameld.com`):**
1. In your DNS settings for `zetameld.com`, add an `A` record:
   - **Name:** `monu` (or `*.zetameld.com` for wildcards)
   - **Value:** `YOUR_SERVER_PUBLIC_IP`
2. Open your browser or run:
   ```bash
   curl http://monu.zetameld.com:4002/health.json
   ```

---

### 4. Multiple Domains / Multi-User Example

You can map different domains to different local ports:

```bash
python3 local.py \
  --server 127.0.0.1:9000 \
  --token MySecret123 \
  --route monu.zetameld.com=127.0.0.1:3000 \
  --route api.zetameld.com=127.0.0.1:8000 \
  --route app.zetameld.com=127.0.0.1:5000
```

- Requests with `Host: monu.zetameld.com` ➔ forwarded to `127.0.0.1:3000`
- Requests with `Host: api.zetameld.com` ➔ forwarded to `127.0.0.1:8000`
- Requests with `Host: app.zetameld.com` ➔ forwarded to `127.0.0.1:5000`