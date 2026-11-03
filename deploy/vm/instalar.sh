#!/usr/bin/env bash
# Instala o Prumo numa VM Ubuntu 24.04 (Google Compute Engine): PostgreSQL, API, frontend e HTTPS.
# Tudo fica na mesma máquina: banco local (porta 5432 fechada para fora), arquivos em backend/uploads e nginx na frente.
#
# Uso, como root, dentro da cópia do repositório em /opt/manual-operacional:
#   sudo bash deploy/vm/instalar.sh <dominio> <email>
# Exemplo: sudo bash deploy/vm/instalar.sh 34-95-10-20.sslip.io ti@plenasaude.com.br
#
# Pode ser rodado de novo (ex.: para trocar o domínio): não apaga dados nem troca senhas já geradas.
set -euo pipefail

DOMINIO="${1:?Informe o domínio. Ex.: 34-95-10-20.sslip.io}"
EMAIL="${2:?Informe um e-mail para o certificado HTTPS}"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_USER=manual
DB_NAME=manual_operacional
DB_USER=manual_app
SERVICE=manual-operacional-api
ENV_FILE="$APP_DIR/backend/.env"
NPM_CACHE=/var/cache/manual-operacional-npm

[ "$(id -u)" -eq 0 ] || { echo "Rode com sudo."; exit 1; }
as_app() { runuser -u "$APP_USER" -- env npm_config_cache="$NPM_CACHE" "$@"; }

echo "==> 1/8 Pacotes do sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git openssl nginx postgresql certbot python3-certbot-nginx
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> 2/8 Memória de troca (evita falta de memória no build em VMs pequenas)"
if [ ! -f /swapfile ] && [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 3000 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> 3/8 Usuário do sistema '$APP_USER'"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --no-create-home --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$NPM_CACHE" "$APP_DIR/backend/uploads"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$NPM_CACHE"

echo "==> 4/8 Banco de dados PostgreSQL"
systemctl enable --now postgresql
if [ -f "$ENV_FILE" ] && ! grep -Eq '^DATABASE_URL=postgresql://[^@]+@127\.0\.0\.1' "$ENV_FILE"; then
  echo "O arquivo $ENV_FILE já existe e não aponta para o banco desta VM."
  echo "Ele provavelmente veio do seu computador. Apague-o (rm $ENV_FILE) e rode de novo."
  exit 1
fi
if [ ! -f "$ENV_FILE" ]; then
  DB_PASS="$(openssl rand -hex 24)"
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 -v user="$DB_USER" -v pass="$DB_PASS" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN', :'user') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'user')\gexec
SELECT format('ALTER ROLE %I PASSWORD %L', :'user', :'pass')\gexec
SQL
  cat > "$ENV_FILE" <<ENV
# Gerado por deploy/vm/instalar.sh. Contém senhas: não copie para fora da VM.
PORT=4000
FRONTEND_URL=https://$DOMINIO
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@127.0.0.1:5432/$DB_NAME
DB_SSL=false
DB_POOL_MAX=10
JWT_SECRET=$(openssl rand -hex 32)
DEV_DEMO_MODE=false
TRUST_PROXY_HOPS=1
STORAGE_DRIVER=local
UPLOAD_MAX_PDF_MB=20
UPLOAD_MAX_VIDEO_MB=200
ENV
fi
sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMINIO|" "$ENV_FILE"
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"
DATABASE_URL="$(grep '^DATABASE_URL=' "$ENV_FILE" | cut -d= -f2-)"
runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
  || runuser -u postgres -- createdb --owner="$DB_USER" "$DB_NAME"
# As tabelas são criadas pelo próprio usuário da aplicação, que fica dono delas.
if [ -z "$(psql "$DATABASE_URL" -tAc "SELECT to_regclass('public.users')")" ]; then
  PGOPTIONS="--client-min-messages=warning" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$APP_DIR/backend/sql/schema.sql"
  echo "Tabelas criadas. Login inicial: admin / admin123 (troque no primeiro acesso)."
fi

echo "==> 5/8 Dependências e build do frontend"
(cd "$APP_DIR/backend" && as_app npm ci --omit=dev --no-audit --no-fund)
(cd "$APP_DIR/frontend" && as_app npm ci --no-audit --no-fund && as_app VITE_API_URL="https://$DOMINIO" npm run build)

echo "==> 6/8 Serviço da API"
cat > "/etc/systemd/system/$SERVICE.service" <<UNIT
[Unit]
Description=Prumo - API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
User=$APP_USER
WorkingDirectory=$APP_DIR/backend
ExecStart=$(command -v node) src/server.js
Environment=NODE_ENV=production
Restart=always
RestartSec=5
TimeoutStopSec=15
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

echo "==> 7/8 nginx e HTTPS"
cat > /etc/nginx/sites-available/manual-operacional <<NGINX
# Gerado por deploy/vm/instalar.sh. Frontend estático, API em 127.0.0.1:4000 e arquivos de backend/uploads.
server {
    listen 80;
    server_name $DOMINIO;

    root $APP_DIR/frontend/dist;
    index index.html;

    # Vídeo de até 200 MB passa pelo nginx até a API.
    client_max_body_size 260m;
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_request_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
    }

    location /health {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host \$host;
    }

    # PDFs e vídeos saem direto do disco (com suporte a avanço no vídeo), sem passar pela API.
    location /uploads/ {
        alias $APP_DIR/backend/uploads/;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location / {
        add_header Cache-Control "no-cache";
        try_files \$uri /index.html;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/manual-operacional /etc/nginx/sites-enabled/manual-operacional
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
if ! certbot --nginx -d "$DOMINIO" -m "$EMAIL" --agree-tos --redirect --non-interactive; then
  echo "Falha ao emitir o certificado HTTPS. Confira se $DOMINIO aponta para o IP desta VM"
  echo "e se o firewall libera as portas 80 e 443. Depois rode este script de novo."
  exit 1
fi

echo "==> 8/8 Cópia diária do banco"
ln -sf "$APP_DIR/deploy/vm/backup.sh" /etc/cron.daily/manual-operacional-backup
chmod +x "$APP_DIR/deploy/vm/backup.sh" "$APP_DIR/deploy/vm/atualizar.sh"

for _ in $(seq 1 30); do
  if curl -fs http://127.0.0.1:4000/health/ready >/dev/null; then
    echo
    echo "Pronto: https://$DOMINIO"
    exit 0
  fi
  sleep 1
done
echo "A API não respondeu. Veja o motivo com: journalctl -u $SERVICE -n 50"
exit 1
