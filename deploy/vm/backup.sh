#!/usr/bin/env bash
# Cópia diária do banco, chamada pelo cron (/etc/cron.daily). Guarda 14 dias em /var/backups/manual-operacional.
# Fica no mesmo disco da VM: os PDFs, vídeos e estas cópias só sobrevivem a perda da VM com o snapshot agendado do disco.
# Restaurar (com a API parada): sudo -u postgres pg_restore --clean --if-exists -d manual_operacional < /var/backups/manual-operacional/banco-AAAA-MM-DD.dump
set -euo pipefail

DEST=/var/backups/manual-operacional
mkdir -p "$DEST"
chmod 700 "$DEST"
runuser -u postgres -- pg_dump -Fc manual_operacional > "$DEST/banco-$(date +%F).dump"
find "$DEST" -name 'banco-*.dump' -mtime +14 -delete
