#!/usr/bin/env bash
# dev.sh — start the repo-summary-prompt UI server locally
#
# Usage:
#   ./dev.sh          # start
#   ./dev.sh restart  # kill any running instance, then start fresh
#   ./dev.sh stop     # kill any running instance and exit
#
# Environment variables (optional, pass before the script or export):
#   PORT                  Server port (default: 3000)
#   REPO_STATS_API_URL    Override the default upstream stats API URL
#   USE_OLLAMA            Set to "true" to enable local Ollama AI analysis
#   OLLAMA_URL            Ollama server URL (e.g. http://localhost:11434)
#   OLLAMA_MODEL          Ollama model name (e.g. llama3)
#   MAX_DAILY_FETCHES     Daily fetch quota (default: 20, "unlimited" to disable)

set -euo pipefail

PIDFILE=".dev-server.pid"

stop_server() {
  if [[ -f "$PIDFILE" ]]; then
    local pid
    pid=$(cat "$PIDFILE")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping server (PID $pid)..."
      kill "$pid"
      # Wait up to 3s for graceful shutdown
      local i=0
      while kill -0 "$pid" 2>/dev/null && (( i < 30 )); do
        sleep 0.1
        (( i++ ))
      done
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" || true
    fi
    rm -f "$PIDFILE"
  fi
}

case "${1:-start}" in
  stop)
    stop_server
    echo "Done."
    exit 0
    ;;
  restart)
    stop_server
    ;;
  start)
    ;;
  *)
    echo "Usage: $0 [start|stop|restart]" >&2
    exit 1
    ;;
esac

# Install UI dependencies if missing
if [[ ! -d ui/node_modules ]]; then
  echo "Installing UI dependencies..."
  (cd ui && npm install)
fi

# Install root dependencies if missing
if [[ ! -d node_modules ]]; then
  echo "Installing root dependencies..."
  npm install
fi

PORT="${PORT:-3000}"
echo "Starting server on http://localhost:${PORT} ..."

node ui/server.mjs &
SERVER_PID=$!
echo "$SERVER_PID" > "$PIDFILE"
echo "Server PID: $SERVER_PID (stored in $PIDFILE)"
echo "Press Ctrl+C to stop."

# Clean up on exit
trap 'stop_server; exit 0' INT TERM

wait "$SERVER_PID"
rm -f "$PIDFILE"
