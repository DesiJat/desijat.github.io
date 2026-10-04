#!/usr/bin/env bash

# ==============================================================================
# Dynamic Reverse Tunnel Controller
# Manage Local HTTP Server, Reverse Tunnel Server, and Client Connector
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ----------------- Configuration & Defaults -----------------
TOKEN="${TOKEN:-MySecret123}"
HTTP_PORT="${HTTP_PORT:-3000}"
ENABLE_TLS="${ENABLE_TLS:-false}"

if [[ "$ENABLE_TLS" == "true" ]]; then
    PUBLIC_PORT="${PUBLIC_PORT:-8443}"
else
    PUBLIC_PORT="${PUBLIC_PORT:-8080}"
fi

TUNNEL_PORT="${TUNNEL_PORT:-9000}"
STATUS_PORT="${STATUS_PORT:-8081}"

# Detect LAN IP on macOS (fallback to Linux or 127.0.0.1)
detect_ip() {
    local ip=""
    if [[ "$(uname)" == "Darwin" ]]; then
        ip=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)
    fi
    if [[ -z "$ip" ]]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
    fi
    echo "${ip:-127.0.0.1}"
}

LAN_IP=$(detect_ip)
SERVER_HOST="${SERVER_HOST:-127.0.0.1}"

# Certs and logs directories
CERTS_DIR="$SCRIPT_DIR/certs"
CERT_FILE="$CERTS_DIR/cert.pem"
KEY_FILE="$CERTS_DIR/key.pem"

LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
HTTP_LOG="$LOG_DIR/http.log"
SERVER_LOG="$LOG_DIR/server.log"
LOCAL_LOG="$LOG_DIR/local.log"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ----------------- Helper Functions -----------------

print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "============================================================"
    echo "  🚀 Reverse Tunnel Automation Manager"
    echo "============================================================"
    echo -e "${NC}"
}

generate_certs() {
    mkdir -p "$CERTS_DIR"
    if [[ ! -f "$CERT_FILE" || ! -f "$KEY_FILE" ]]; then
        echo -e "${YELLOW}🔑 Generating self-signed SSL/TLS certificate in $CERTS_DIR...${NC}"
        openssl req -x509 -newkey rsa:2048 -nodes \
            -keyout "$KEY_FILE" -out "$CERT_FILE" -days 365 \
            -subj "/CN=127.0.0.1" 2>/dev/null
        echo -e "${GREEN}✓ Certificates created: cert.pem, key.pem${NC}"
    else
        echo -e "${GREEN}✓ Existing certificates found in $CERTS_DIR${NC}"
    fi
}

stop_services() {
    echo -e "${YELLOW}🛑 Stopping any running services and freeing ports ($HTTP_PORT, $PUBLIC_PORT, 8080, 8443, $TUNNEL_PORT, $STATUS_PORT)...${NC}"

    # Kill by port number if occupied
    local pids=$(lsof -t -i :"$HTTP_PORT" -i :"$PUBLIC_PORT" -i :8080 -i :8443 -i :"$TUNNEL_PORT" -i :"$STATUS_PORT" 2>/dev/null || true)
    if [[ -n "$pids" ]]; then
        echo -e "${YELLOW}Killing processes on ports: $pids${NC}"
        kill -9 $pids 2>/dev/null || true
    fi

    # Kill by command pattern
    pkill -f "python3 -m http.server $HTTP_PORT" 2>/dev/null || true
    pkill -f "python3.*server.py" 2>/dev/null || true
    pkill -f "python3.*local.py" 2>/dev/null || true

    sleep 1
    echo -e "${GREEN}✓ All services stopped successfully.${NC}"
}

start_services() {
    stop_services

    local PROTOCOL="http"
    local SERVER_EXTRA_ARGS=()
    local LOCAL_EXTRA_ARGS=()

    if [[ "$ENABLE_TLS" == "true" ]]; then
        generate_certs
        PROTOCOL="https"
        SERVER_EXTRA_ARGS=(
            "--tunnel-tls-cert" "$CERT_FILE"
            "--tunnel-tls-key" "$KEY_FILE"
            "--public-tls-cert" "$CERT_FILE"
            "--public-tls-key" "$KEY_FILE"
        )
        LOCAL_EXTRA_ARGS=("--tls" "--insecure")
    fi

    echo ""
    echo -e "${BLUE}${BOLD}⚙️  Configuration:${NC}"
    echo -e "  • Mode          : ${CYAN}$( [[ "$ENABLE_TLS" == "true" ]] && echo "🔒 TLS / HTTPS Enabled" || echo "Plain HTTP" )${NC}"
    echo -e "  • Token         : ${CYAN}$TOKEN${NC}"
    echo -e "  • Local HTTP    : ${CYAN}http://127.0.0.1:$HTTP_PORT${NC}"
    echo -e "  • Public Server : ${CYAN}$PROTOCOL://0.0.0.0:$PUBLIC_PORT${NC} (LAN: $PROTOCOL://$LAN_IP:$PUBLIC_PORT)"
    echo -e "  • Tunnel Server : ${CYAN}127.0.0.1:$TUNNEL_PORT (TLS: $ENABLE_TLS)${NC}"
    echo -e "  • Health/Status : ${CYAN}http://127.0.0.1:$STATUS_PORT/health${NC}"
    echo -e "  • Logs Dir      : ${CYAN}$LOG_DIR${NC}"
    echo ""

    # 1. Start Local HTTP Server
    echo -e "${BLUE}[1/3] Starting Local HTTP Server on port $HTTP_PORT...${NC}"
    nohup python3 -u -m http.server "$HTTP_PORT" > "$HTTP_LOG" 2>&1 &
    HTTP_PID=$!
    echo -e "      ${GREEN}✓ Local HTTP Server running (PID: $HTTP_PID)${NC}"

    # 2. Start Tunnel Server
    echo -e "${BLUE}[2/3] Starting Reverse Tunnel Server (Public: $PUBLIC_PORT, Tunnel: $TUNNEL_PORT, TLS: $ENABLE_TLS)...${NC}"
    nohup python3 -u server.py \
        --token "$TOKEN" \
        --public-port "$PUBLIC_PORT" \
        --tunnel-port "$TUNNEL_PORT" \
        --status-port "$STATUS_PORT" \
        "${SERVER_EXTRA_ARGS[@]}" > "$SERVER_LOG" 2>&1 &
    SERVER_PID=$!
    echo -e "      ${GREEN}✓ Server running (PID: $SERVER_PID)${NC}"

    sleep 1

    # 3. Start Local Client Connector
    echo -e "${BLUE}[3/3] Starting Local Client Connector (TLS: $ENABLE_TLS)...${NC}"
    nohup python3 -u local.py \
        --server "$SERVER_HOST:$TUNNEL_PORT" \
        --token "$TOKEN" \
        --local "127.0.0.1:$HTTP_PORT" \
        "${LOCAL_EXTRA_ARGS[@]}" > "$LOCAL_LOG" 2>&1 &
    LOCAL_PID=$!
    echo -e "      ${GREEN}✓ Local Client Connector running (PID: $LOCAL_PID)${NC}"

    sleep 1.5
    echo ""
    echo -e "${GREEN}${BOLD}🎉 All components started successfully!${NC}"
    echo ""
    run_test
}

check_status() {
    echo -e "${BLUE}${BOLD}📊 Service Status Check:${NC}"
    echo "------------------------------------------------------------"
    
    check_port() {
        local name="$1"
        local port="$2"
        local pid=$(lsof -t -i :"$port" 2>/dev/null || true)
        if [[ -n "$pid" ]]; then
            echo -e "  $name (Port $port): ${GREEN}RUNNING${NC} (PID: $pid)"
        else
            echo -e "  $name (Port $port): ${RED}NOT RUNNING${NC}"
        fi
    }

    check_port "1. Local HTTP Server" "$HTTP_PORT"
    check_port "2. Tunnel Server (Public)" "$PUBLIC_PORT"
    check_port "3. Tunnel Server (Tunnel)" "$TUNNEL_PORT"
    check_port "4. Health/Status Server" "$STATUS_PORT"

    echo "------------------------------------------------------------"
}

run_test() {
    # Auto-detect protocol (HTTPS or HTTP)
    local PROTO="http"
    local CURL_FLAGS=("-s" "-o" "/dev/null" "-w" "%{http_code}")
    
    # Quick probe to see if port responds to HTTPS
    local probe_https=$(curl -k -s -o /dev/null -w "%{http_code}" "https://127.0.0.1:$PUBLIC_PORT/health.json" 2>/dev/null || echo "000")
    if [[ "$probe_https" == "200" || "$probe_https" == "404" ]]; then
        PROTO="https"
        CURL_FLAGS+=("-k")
    fi

    echo -e "${BLUE}${BOLD}🧪 Testing Endpoints (Protocol: $PROTO):${NC}"

    echo -n "  • Testing Direct Local HTTP (http://127.0.0.1:$HTTP_PORT/health.json): "
    local local_res=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$HTTP_PORT/health.json" 2>/dev/null || echo "FAIL")
    if [[ "$local_res" == "200" ]]; then
        echo -e "${GREEN}SUCCESS (HTTP $local_res)${NC}"
    else
        echo -e "${RED}FAILED ($local_res)${NC}"
    fi

    echo -n "  • Testing Via Tunnel Public Port ($PROTO://127.0.0.1:$PUBLIC_PORT/health.json): "
    local tunnel_res=$(curl "${CURL_FLAGS[@]}" "$PROTO://127.0.0.1:$PUBLIC_PORT/health.json" 2>/dev/null || echo "FAIL")
    if [[ "$tunnel_res" == "200" ]]; then
        echo -e "${GREEN}SUCCESS (HTTP $tunnel_res)${NC}"
    else
        echo -e "${RED}FAILED ($tunnel_res)${NC}"
    fi

    if [[ "$LAN_IP" != "127.0.0.1" ]]; then
        echo -n "  • Testing Via LAN IP ($PROTO://$LAN_IP:$PUBLIC_PORT/health.json): "
        local lan_res=$(curl "${CURL_FLAGS[@]}" "$PROTO://$LAN_IP:$PUBLIC_PORT/health.json" 2>/dev/null || echo "FAIL")
        if [[ "$lan_res" == "200" ]]; then
            echo -e "${GREEN}SUCCESS (HTTP $lan_res)${NC}"
        else
            echo -e "${YELLOW}HTTP $lan_res${NC}"
        fi
    fi

    echo ""
    echo -e "${CYAN}Sample curl test commands:${NC}"
    if [[ "$PROTO" == "https" ]]; then
        echo "  curl -k https://127.0.0.1:$PUBLIC_PORT/health.json"
        echo "  curl -k https://$LAN_IP:$PUBLIC_PORT/health.json"
    else
        echo "  curl http://127.0.0.1:$PUBLIC_PORT/health.json"
        echo "  curl http://$LAN_IP:$PUBLIC_PORT/health.json"
    fi
    echo "  curl http://127.0.0.1:$STATUS_PORT/health"
    echo ""
}

show_logs() {
    local target="${1:-all}"
    case "$target" in
        server)
            echo -e "${CYAN}Streaming server.log (Ctrl+C to exit)...${NC}"
            tail -f "$SERVER_LOG"
            ;;
        local)
            echo -e "${CYAN}Streaming local.log (Ctrl+C to exit)...${NC}"
            tail -f "$LOCAL_LOG"
            ;;
        http)
            echo -e "${CYAN}Streaming http.log (Ctrl+C to exit)...${NC}"
            tail -f "$HTTP_LOG"
            ;;
        all|*)
            echo -e "${CYAN}Showing latest logs from all services:${NC}"
            echo -e "\n${BOLD}=== server.log ===${NC}"
            tail -n 10 "$SERVER_LOG" 2>/dev/null || echo "No server log yet."
            echo -e "\n${BOLD}=== local.log ===${NC}"
            tail -n 10 "$LOCAL_LOG" 2>/dev/null || echo "No local log yet."
            echo -e "\n${BOLD}=== http.log ===${NC}"
            tail -n 10 "$HTTP_LOG" 2>/dev/null || echo "No http log yet."
            ;;
    esac
}

show_help() {
    print_banner
    echo -e "${BOLD}Usage:${NC} $0 [COMMAND] [OPTIONS]"
    echo ""
    echo -e "${BOLD}Commands:${NC}"
    echo -e "  ${GREEN}start | up${NC}          Start all 3 services in standard HTTP mode"
    echo -e "  ${GREEN}start-tls | tls${NC}     Start all 3 services with SSL/TLS encryption (HTTPS port 8443)"
    echo -e "  ${YELLOW}certs${NC}               Generate self-signed SSL/TLS certificates in ./certs/"
    echo -e "  ${RED}stop | down${NC}         Stop and terminate all running background processes"
    echo -e "  ${YELLOW}restart${NC}             Restart all services"
    echo -e "  ${CYAN}status${NC}              Show running status and port occupancy"
    echo -e "  ${BLUE}test${NC}                Test local & proxied endpoints with curl"
    echo -e "  ${BOLD}logs [server|local|http]${NC} Tail logs for a specific service or view summary"
    echo -e "  ${BOLD}help${NC}                Display this help message"
    echo ""
    echo -e "${BOLD}Custom Environment Variables:${NC}"
    echo -e "  ENABLE_TLS     Set to 'true' to enable SSL/TLS (default: ${CYAN}false${NC})"
    echo -e "  TOKEN          Shared auth token (default: ${CYAN}MySecret123${NC})"
    echo -e "  HTTP_PORT      Local service port (default: ${CYAN}3000${NC})"
    echo -e "  PUBLIC_PORT    Public incoming port (default: ${CYAN}8080${NC} or ${CYAN}8443${NC} with TLS)"
    echo -e "  TUNNEL_PORT    Tunnel connection port (default: ${CYAN}9000${NC})"
    echo -e "  STATUS_PORT    Health status endpoint port (default: ${CYAN}8081${NC})"
    echo -e "  SERVER_HOST    Host where client connects (default: ${CYAN}127.0.0.1${NC})"
    echo ""
    echo -e "${BOLD}Examples:${NC}"
    echo "  $0 start                 # Plain HTTP mode"
    echo "  $0 start-tls             # SSL/TLS encrypted tunnel + HTTPS public port 8443"
    echo "  $0 test                  # Test endpoints"
    echo "  $0 logs server           # View server logs"
    echo "  $0 stop                  # Stop all background services"
    echo ""
}

# ----------------- CLI Argument Router -----------------

ACTION="${1:-help}"

case "$ACTION" in
    start|up)
        print_banner
        start_services
        ;;
    start-tls|tls)
        print_banner
        ENABLE_TLS="true"
        PUBLIC_PORT="${PUBLIC_PORT:-8443}"
        start_services
        ;;
    certs)
        print_banner
        generate_certs
        ;;
    stop|down)
        print_banner
        stop_services
        ;;
    restart)
        print_banner
        start_services
        ;;
    status)
        print_banner
        check_status
        ;;
    test)
        print_banner
        run_test
        ;;
    logs)
        show_logs "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $ACTION${NC}"
        show_help
        exit 1
        ;;
esac

