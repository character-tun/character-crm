#!/usr/bin/env bash
set -euo pipefail

B="http://localhost:5002"

need() { command -v "$1" >/dev/null || { echo "❌ Требуется $1"; exit 1; }; }
need curl
need jq

echo "▶ API check"
curl -fsS "$B/api/public/status" | jq .

# Регистрация / первичный bootstrap админа (если есть роут)
echo "▶ Try bootstrap-admin (best-effort)…"
BOOT_RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/auth/bootstrap-admin" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin1234","name":"Admin User"}' || true)
case "$BOOT_RC" in
  201) echo "✔ bootstrap-admin ok" ;;
  400) echo "ℹ users already exist — пропускаю" ;;
  404) echo "ℹ /api/auth/bootstrap-admin not found — пропускаю" ;;
  *)   echo "ℹ bootstrap-admin rc=$BOOT_RC — пропускаю";;
esac

echo "▶ Login"
BODY_LOGIN=$(jq -n --arg e "admin@example.com" --arg p "admin1234" '{email:$e, password:$p}')
TOKEN=$(curl -fsS -X POST "$B/api/auth/login" -H "Content-Type: application/json" -d "$BODY_LOGIN" | jq -r '.accessToken // .access // empty' || true)

if [ -z "$TOKEN" ]; then
  echo "❌ Не получил accessToken. Вероятно, регистрация отключена, а пользователя нет."
  echo "   Варианты:"
  echo "   1) Включить DEV-авторизацию (в .env: AUTH_DEV_MODE=1, AUTH_DEV_EMAIL, AUTH_DEV_PASSWORD) и перезапустить сервер."
  echo "   2) Проверь /api/auth/login ответ (ожидается 'accessToken') и роуты в routes/auth.js."
  exit 1
fi

echo "✔ Logged in"
echo "access=$TOKEN"
AH="Authorization: Bearer $TOKEN"

echo "▶ Create dict colors (idempotent)"
D_RC=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/dicts" -H "$AH" -H "Content-Type: application/json" \
  -d '{"code":"colors","values":["red","green","blue"]}')
[ "$D_RC" = 201 ] && echo "✔ dict created" || echo "ℹ dict rc=$D_RC (maybe already)"

echo "▶ Create fields schema (order v1)"
FIELDS_BODY=$(jq -n '{
  scope:"orders",
  name:"Форма заказа",
  isActive:true,
  fields:[
    {code:"car_model",label:"Модель авто",type:"text",required:true},
    {code:"color",label:"Цвет",type:"list",options:["red","green","blue"]}
  ]
}')
FIELDS_SCHEMA_ID=$(curl -fsS -X POST "$B/api/fields/schemas" -H "$AH" -H "Content-Type: application/json" -d "$FIELDS_BODY" | jq -r '.item._id // ._id // empty')

if [ -z "$FIELDS_SCHEMA_ID" ]; then
  FIELDS_SCHEMA_ID=$(curl -s "$B/api/fields" -H "$AH" | jq -r '[.items[] | select(.scope=="orders" and .isActive==true)][0]._id // empty')
fi
[ -n "$FIELDS_SCHEMA_ID" ] || { echo "❌ no FIELDS_SCHEMA_ID"; exit 1; }
echo "✔ FIELDS_SCHEMA_ID=$FIELDS_SCHEMA_ID"

echo "▶ Pick first orderType (or create default)"
ORDER_TYPE_ID=$(curl -s "$B/api/order-types" -H "$AH" | jq -r '.items[0]._id // empty')
if [ -z "$ORDER_TYPE_ID" ]; then
  echo "ℹ orderTypes пуст — создаю default (DEV mode)"
  ORDER_TYPE_ID=$(curl -s -X POST "$B/api/order-types" -H "$AH" -H "Content-Type: application/json" -d '{
    "code":"default","name":"Default","isSystem":true,
    "allowedStatuses":[],"docTemplateIds":[]
  }' | jq -r '.item._id // empty')
fi
[ -n "$ORDER_TYPE_ID" ] || { echo "❌ no ORDER_TYPE_ID"; exit 1; }
echo "✔ ORDER_TYPE_ID=$ORDER_TYPE_ID"

echo "▶ Patch orderType: attach schema"
curl -s -X PATCH "$B/api/order-types/$ORDER_TYPE_ID" -H "$AH" -H "Content-Type: application/json" \
  -d "{\"fieldsSchemaId\":\"$FIELDS_SCHEMA_ID\"}" | jq .

echo "▶ Create test order"
ORDER_BODY=$(jq -n --arg t "$ORDER_TYPE_ID" '{
  orderTypeId:$t,
  title:"Тестовый заказ",
  fields:{car_model:"Civic", color:"red"}
}')
ORDER_JSON=$(curl -fsS -X POST "$B/api/orders" -H "$AH" -H "Content-Type: application/json" -d "$ORDER_BODY")
ORDER_ID=$(echo "$ORDER_JSON" | jq -r '.item._id // ._id // empty')
[ -n "$ORDER_ID" ] || { echo "❌ no ORDER_ID"; echo "$ORDER_JSON" | jq .; exit 1; }
echo "$ORDER_JSON" | jq .

# Доп: смена статуса (используем x-user-role без Bearer, чтобы пройти requireRole)
echo "▶ Change status to in_work"
STATUS_BODY=$(jq -n '{code:"in_work"}')
curl -s -X PATCH "$B/api/orders/$ORDER_ID/status" -H "Content-Type: application/json" -H "x-user-role: orders.changeStatus" -H "x-user-id: demo" -d "$STATUS_BODY" | jq .

# Чтение заказа новым GET /api/orders/:id
echo "▶ Read order"
curl -s "$B/api/orders/$ORDER_ID" -H "$AH" | jq .

echo "✅ Done. ORDER_ID=$ORDER_ID"
