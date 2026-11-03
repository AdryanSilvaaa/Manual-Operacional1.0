#!/usr/bin/env bash
# Atualiza a VM com a versão do GitHub: baixa o código, reinstala dependências, gera o frontend e reinicia a API.
# Uso: sudo bash /opt/manual-operacional/deploy/vm/atualizar.sh
# Mudanças no banco (backend/sql) não são aplicadas aqui; rode o SQL novo antes, com backup feito.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_USER=manual
SERVICE=manual-operacional-api
NPM_CACHE=/var/cache/manual-operacional-npm

[ "$(id -u)" -eq 0 ] || { echo "Rode com sudo."; exit 1; }
as_app() { runuser -u "$APP_USER" -- env npm_config_cache="$NPM_CACHE" "$@"; }
FRONTEND_URL="$(grep '^FRONTEND_URL=' "$APP_DIR/backend/.env" | cut -d= -f2-)"

as_app git -C "$APP_DIR" pull --ff-only
(cd "$APP_DIR/backend" && as_app npm ci --omit=dev --no-audit --no-fund)
(cd "$APP_DIR/frontend" && as_app npm ci --no-audit --no-fund && as_app VITE_API_URL="$FRONTEND_URL" npm run build)
systemctl restart "$SERVICE"

for _ in $(seq 1 30); do
  curl -fs http://127.0.0.1:4000/health/ready >/dev/null && { echo "Atualizado: $FRONTEND_URL"; exit 0; }
  sleep 1
done
echo "A API não respondeu. Veja o motivo com: journalctl -u $SERVICE -n 50"
exit 1
