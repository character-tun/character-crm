#!/usr/bin/env bash
set -euo pipefail

Cyan='\033[0;36m'; Green='\033[0;32m'; Yellow='\033[1;33m'; Red='\033[0;31m'; NC='\033[0m'
log(){ echo -e "${Cyan}▶ $*${NC}"; }
ok(){ echo -e "${Green}✔ $*${NC}"; }
warn(){ echo -e "${Yellow}⚠ $*${NC}"; }
err(){ echo -e "${Red}✖ $*${NC}"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

#-------------------------------
# 0) Предусловия
#-------------------------------
if ! command -v brew >/dev/null 2>&1; then
  err "Homebrew не найден. Установите brew и запустите скрипт снова: https://brew.sh"
  exit 1
fi

#-------------------------------
# 1) MongoDB 7 + mongosh + rs0
#-------------------------------
log "Проверяю Mongo tap и пакеты…"
brew tap mongodb/brew >/dev/null 2>&1 || true
if ! brew list --versions mongodb-community@7.0 >/dev/null 2>&1; then
  brew install mongodb/brew/mongodb-community@7.0 mongosh
fi
brew services start mongodb/brew/mongodb-community@7.0

CONF_PATH="$(brew --prefix)/etc/mongod.conf"
if ! grep -q "replication:" "$CONF_PATH" 2>/dev/null; then
  log "Включаю replicaSet rs0…"
  printf "\nreplication:\n  replSetName: rs0\n" | tee -a "$CONF_PATH" >/dev/null
  brew services restart mongodb/brew/mongodb-community@7.0
fi

log "Инициализирую rs0 (если ещё не)…"
mongosh --quiet --eval "try{ rs.status().ok }catch(e){0 }" | grep -q 1 || mongosh --quiet --eval 'rs.initiate()' || true

log "Проверяю ping Mongo…"
mongosh --quiet --eval 'db.runCommand({ping:1}).ok' | grep -q 1 && ok "Mongo OK" || { err "Mongo ping failed"; exit 1; }

#-------------------------------
# 2) Redis
#-------------------------------
log "Проверяю/ставлю Redis…"
if ! brew list --versions redis >/dev/null 2>&1; then
  brew install redis
fi
brew services start redis
if command -v redis-cli >/dev/null 2>&1; then
  redis-cli ping | grep -q PONG && ok "Redis OK" || { err "Redis ping failed"; exit 1; }
else
  warn "redis-cli не найден, продолжаю (служба redis запущена)."
fi

#-------------------------------
# 3) .env для сервера (реальная БД)
#-------------------------------
ENV_FILE="$ROOT_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  log "Создаю .env…"
  cat > "$ENV_FILE" <<EOF
AUTH_DEV_MODE=0
MONGO_URL=mongodb://127.0.0.1:27017/trae_dev?replicaSet=rs0
REDIS_URL=redis://127.0.0.1:6379
CACHE_TTL_SECS=60
NOTIFY_DRY_RUN=1
PRINT_DRY_RUN=1
JWT_SECRET=dev-local-secret
CORS_ORIGIN=http://localhost:3007
EOF
else
  log ".env найден — обновляю ключевые значения…"
  perl -0777 -pe 's/^AUTH_DEV_MODE=.*$/AUTH_DEV_MODE=0/mg' -i "$ENV_FILE" || true
  perl -0777 -pe 's|^MONGO_URL=.*$|MONGO_URL=mongodb://127.0.0.1:27017/trae_dev?replicaSet=rs0|mg' -i "$ENV_FILE" || true
  if ! grep -q '^REDIS_URL=' "$ENV_FILE"; then echo 'REDIS_URL=redis://127.0.0.1:6379' >> "$ENV_FILE"; fi
fi
ok ".env готов"

#-------------------------------
# 4) Установка пакетов
#-------------------------------
log "Устанавливаю зависимости (root)…"
npm install --silent

#-------------------------------
# 5) Сиды/миграции (idempotent)
#-------------------------------
log "Прогоняю сиды/миграции…"
npm run --silent seed:orderStatuses || true
npm run --silent seed:orderTypes || true
[ -f scripts/migrations/2025-10-OrderType-backfill.js ] && node scripts/migrations/2025-10-OrderType-backfill.js || true
[ -f scripts/seedFieldSchemas.js ] && node scripts/seedFieldSchemas.js || true

#-------------------------------
# 6) Быстрый health-check API
#-------------------------------
log "Поднимаю сервер для health-check (в фоне)…"
# Запускаем временно сервер на :5002, ждём статус и глушим
node server.js >/tmp/trae-server.log 2>&1 &
SRV_PID=$!
trap 'kill $SRV_PID >/dev/null 2>&1 || true' EXIT

# Ждём старт
for i in {1..30}; do
  sleep 1
  if curl -fsS "http://localhost:5002/api/public/status" >/dev/null 2>&1; then
    ok "API health OK"; break
  fi
  [ $i -eq 30 ] && { err "API не ответил за 30с. Лог: /tmp/trae-server.log"; exit 1; }
done

#-------------------------------
# 7) Итог
#-------------------------------
ok "Готово! Mongo(rs0)+Redis настроены, .env прописан, сиды/миграции применены."
echo -e "${Green}Дальше:${NC}
  1) В одном терминале:    npm run server
  2) В другом терминале:   cd client && echo 'PORT=3007' > .env.local && npm start
  UI → http://localhost:3007/  API → http://localhost:5002/"
