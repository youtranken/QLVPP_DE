#!/usr/bin/env bash
#
# Kiểm tra kết nối tới PMH ID THẬT trước khi cắm DE-VPP vào.
#
# Chạy theo thứ tự từ thấp lên cao — DNS → TLS → discovery → credential → Directory —
# và DỪNG ở bước hỏng đầu tiên, để biết chính xác hỏng ở tầng nào thay vì chỉ thấy
# "đăng nhập không được".
#
#   bash scripts/check-pmh-id.sh                       # đọc cấu hình từ .env
#   ENV_FILE=deploy/.env.prod bash scripts/check-pmh-id.sh
#
# KHÔNG in bí mật ra màn hình — chỉ nói có/không và độ dài, để dán log đi hỏi được
# mà không lộ secret.
set -u

ENV_FILE=${ENV_FILE:-.env}

if [ -f "$ENV_FILE" ]; then
  # Chỉ nạp các khoá cần, không `source` cả file: file .env có giá trị chứa dấu
  # cách và ký tự đặc biệt, source vào là shell diễn giải lung tung.
  for key in OIDC_ISSUER OIDC_INTERNAL_ISSUER PMH_CLIENT_ID PMH_CLIENT_SECRET \
             PMH_M2M_CLIENT_ID PMH_M2M_CLIENT_SECRET PMH_DIRECTORY_URL APP_BASE_URL; do
    value=$(grep -E "^${key}=" "$ENV_FILE" | tail -1 | cut -d= -f2-)
    [ -n "${value:-}" ] && export "$key=$value"
  done
else
  echo "Không thấy $ENV_FILE — dùng biến môi trường đang có."
fi

ISSUER=${OIDC_INTERNAL_ISSUER:-}
[ -z "$ISSUER" ] && ISSUER=${OIDC_ISSUER:-}
if [ -z "$ISSUER" ]; then
  echo "✗ Chưa có OIDC_ISSUER. Đặt trong $ENV_FILE rồi chạy lại."
  exit 1
fi
ISSUER=${ISSUER%/}
SCHEME=$(printf '%s' "$ISSUER" | sed -nE 's|^(https?)://.*|\1|p')
HOST=$(printf '%s' "$ISSUER" | sed -E 's|^https?://||; s|[:/].*$||')
PORT=$(printf '%s' "$ISSUER" | sed -nE 's|^https?://[^:/]+:([0-9]+).*|\1|p')
if [ -z "$PORT" ]; then [ "$SCHEME" = "http" ] && PORT=80 || PORT=443; fi
ORIGIN=$(printf '%s' "$ISSUER" | sed -E 's|(^https?://[^/]+).*|\1|')

echo "Issuer   : $ISSUER"
echo "Host:cổng: $HOST:$PORT"
echo

die() { echo "✗ $1"; [ $# -gt 1 ] && echo "  → $2"; exit 1; }

# ── 1. DNS ──────────────────────────────────────────────────────────────────
if ! getent hosts "$HOST" >/dev/null 2>&1 && ! nslookup "$HOST" >/dev/null 2>&1; then
  die "DNS không phân giải được $HOST" \
      "Cần VPN / bản ghi DNS nội bộ, hoặc thêm dòng vào file hosts."
fi
echo "✓ DNS phân giải được $HOST"

# ── 2. Cổng ─────────────────────────────────────────────────────────────────
if ! curl -sS -k --max-time 10 -o /dev/null "$SCHEME://$HOST:$PORT" 2>/dev/null; then
  die "Không mở được kết nối tới $HOST:$PORT" \
      "Tường lửa chặn, chưa có VPN, hoặc PMH ID không lắng nghe ở cổng này."
fi
echo "✓ Mở được kết nối tới $HOST:$PORT"

# ── 3. Chứng chỉ ────────────────────────────────────────────────────────────
# Tách riêng phép thử CÓ kiểm cert: api chạy bằng Node, mà Node từ chối cert tự ký
# và sẽ chết ở bước discovery dù curl -k vẫn chạy ngon.
CURL_TLS=""
if [ "$SCHEME" = "https" ]; then
  if curl -sS --max-time 10 -o /dev/null "$ISSUER/.well-known/openid-configuration" 2>/dev/null; then
    echo "✓ Chứng chỉ TLS tin cậy được"
  else
    echo "⚠ Chứng chỉ KHÔNG tin cậy được (nhiều khả năng là cert tự ký của môi trường dev)."
    echo "  Node sẽ từ chối cert này ⇒ api hỏng ngay ở bước discovery."
    echo "  Cách xử lý: xin file CA rồi đặt NODE_EXTRA_CA_CERTS trỏ vào nó."
    echo "  Các bước sau đây tạm bỏ kiểm cert để còn kiểm tiếp phần dưới."
    CURL_TLS="-k"
  fi
fi

# ── 4. Discovery ────────────────────────────────────────────────────────────
DISCO=$(curl -sS $CURL_TLS --max-time 15 "$ISSUER/.well-known/openid-configuration" 2>/dev/null)
echo "$DISCO" | grep -q token_endpoint \
  || die "Discovery không trả về cấu hình OIDC hợp lệ" "Nhận được: $(printf '%.120s' "$DISCO")"
echo "✓ Discovery đọc được"
for field in issuer authorization_endpoint token_endpoint jwks_uri; do
  printf '    %-24s %s\n' "$field" \
    "$(printf '%s' "$DISCO" | sed -nE "s/.*\"$field\":\"([^\"]+)\".*/\1/p")"
done

# `iss` trong token sẽ là giá trị issuer mà PMH ID tự khai. Lệch với OIDC_ISSUER của
# app là thư viện OIDC từ chối token — hỏng sau khi đăng nhập, rất khó đoán.
DISCO_ISS=$(printf '%s' "$DISCO" | sed -nE 's/.*"issuer":"([^"]+)".*/\1/p')
if [ -n "${OIDC_ISSUER:-}" ] && [ "${DISCO_ISS%/}" != "${OIDC_ISSUER%/}" ]; then
  echo "⚠ issuer PMH ID khai là '$DISCO_ISS' nhưng OIDC_ISSUER đang là '$OIDC_ISSUER'."
  echo "  Hai giá trị này phải khớp TỪNG KÝ TỰ, nếu không token bị từ chối sau khi đăng nhập."
fi

# ── 5. Credential M2M ───────────────────────────────────────────────────────
echo
if [ -z "${PMH_M2M_CLIENT_ID:-}" ] || [ -z "${PMH_M2M_CLIENT_SECRET:-}" ] \
   || [ "${PMH_M2M_CLIENT_SECRET:-}" = "dev-m2m-secret-change-me" ]; then
  echo "⚠ Chưa điền credential M2M thật ⇒ bỏ qua phép thử Directory API."
  echo "  Điền PMH_M2M_CLIENT_ID / PMH_M2M_CLIENT_SECRET vào $ENV_FILE rồi chạy lại."
  exit 0
fi

TOKEN_URL=$(printf '%s' "$DISCO" | sed -nE 's/.*"token_endpoint":"([^"]+)".*/\1/p')
RESP=$(curl -sS $CURL_TLS --max-time 15 -X POST "$TOKEN_URL" \
  -u "$PMH_M2M_CLIENT_ID:$PMH_M2M_CLIENT_SECRET" \
  -d "grant_type=client_credentials" 2>/dev/null)
TOKEN=$(printf '%s' "$RESP" | sed -nE 's/.*"access_token":"([^"]+)".*/\1/p')
[ -n "$TOKEN" ] || die "Lấy token M2M thất bại" "PMH ID trả về: $(printf '%.200s' "$RESP")"
echo "✓ Lấy được token M2M (client_credentials)"

# ── 6. Directory API ────────────────────────────────────────────────────────
DIR_BASE=${PMH_DIRECTORY_URL:-$ORIGIN}
DIR_BASE=${DIR_BASE%/}
CODE=$(curl -sS $CURL_TLS --max-time 15 -o /tmp/pmh-dir.$$ -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" "$DIR_BASE/api/v1/groups" 2>/dev/null)
if [ "$CODE" = "200" ]; then
  echo "✓ Directory API trả lời 200 tại $DIR_BASE/api/v1/groups"
  echo "  Nhóm client được cấp: $(sed -nE 's/.*"name":"([^"]+)".*/\1/p' /tmp/pmh-dir.$$ | paste -sd, - )"
  echo
  echo "  ⚠ Đối chiếu danh sách trên với VPP_ADMIN_GROUP và VPP_DEPARTMENT_GROUPS."
  echo "    Tên nhóm lệch là mọi người thành 'member' và không ai vào được quản trị."
else
  echo "✗ Directory API trả về HTTP $CODE tại $DIR_BASE/api/v1/groups"
  echo "  $(printf '%.200s' "$(cat /tmp/pmh-dir.$$)")"
fi
rm -f /tmp/pmh-dir.$$

echo
echo "Xong phần kiểm được từ ngoài. Bước còn lại phải làm bằng trình duyệt:"
echo "  mở $APP_BASE_URL → Đăng nhập bằng PMH ID → kiểm /api/me trả đúng sub/email/groups."
