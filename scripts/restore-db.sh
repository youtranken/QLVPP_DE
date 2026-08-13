#!/usr/bin/env bash
#
# Khôi phục CSDL DE-VPP từ một bản sao lưu.
#
#   bash scripts/restore-db.sh deploy/backups/vpp-20260813-090000.sql.gz
#
# ⚠️  GHI ĐÈ toàn bộ dữ liệu hiện có. Script sẽ hỏi xác nhận trước khi làm.
set -euo pipefail

FILE=${1:-}
CONTAINER=${CONTAINER:-vpp-prod-postgres}
DB_USER=${POSTGRES_USER:-vpp}
DB_NAME=${POSTGRES_DB:-vpp}

if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Cách dùng: bash scripts/restore-db.sh <file .sql.gz>" >&2
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Không thấy container '$CONTAINER' đang chạy." >&2
  exit 1
fi

echo "Sắp GHI ĐÈ CSDL '$DB_NAME' trong '$CONTAINER' bằng:"
echo "  $FILE"
read -r -p "Gõ 'KHOI PHUC' để xác nhận: " CONFIRM
[ "$CONFIRM" = "KHOI PHUC" ] || { echo "Đã huỷ."; exit 1; }

echo "→ Dừng api để không có ghi mới trong lúc khôi phục…"
docker stop vpp-prod-api > /dev/null 2>&1 || true

echo "→ Xoá schema cũ và nạp lại…"
# Phải xoá CẢ schema `drizzle` — đó là nơi Drizzle ghi vết migration đã chạy.
# Bỏ sót nó thì lúc nạp lại sẽ xung đột khoá chính và trạng thái migration bị lẫn.
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -q -v ON_ERROR_STOP=1 \
  -c "DROP SCHEMA IF EXISTS public CASCADE;
      DROP SCHEMA IF EXISTS drizzle CASCADE;
      CREATE SCHEMA public;"

# ON_ERROR_STOP=1: thà dừng giữa chừng và báo lỗi, còn hơn khôi phục nửa vời mà
# vẫn in "thành công".
if ! gunzip -c "$FILE" | docker exec -i "$CONTAINER" \
  psql -U "$DB_USER" -d "$DB_NAME" -q -v ON_ERROR_STOP=1; then
  echo "✗ Khôi phục THẤT BẠI — CSDL đang ở trạng thái dở dang." >&2
  echo "  Chạy lại script với bản sao lưu khác, hoặc khôi phục từ snapshot máy chủ." >&2
  docker start vpp-prod-api > /dev/null 2>&1 || true
  exit 1
fi

echo "→ Khởi động lại api…"
docker start vpp-prod-api > /dev/null 2>&1 || true

echo "✓ Đã khôi phục. Kiểm tra lại: curl -s <APP_BASE_URL>/api/health"
