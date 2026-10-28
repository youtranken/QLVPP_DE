#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VPP="${VPP:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
cd "$VPP"
C=(docker compose -f docker-compose.yml)

envval() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r'; }
BACKUP_DIR="$(envval BACKUP_DIR)"; BACKUP_DIR="${BACKUP_DIR:-$VPP/data-backups}"
PASS="$(envval BACKUP_PASSPHRASE)"
PGUSER="$(envval POSTGRES_USER)"; PGDB="$(envval POSTGRES_DB)"; PGPW="$(envval POSTGRES_PASSWORD)"
{ [ -n "$PGUSER" ] && [ -n "$PGDB" ] && [ -n "$PGPW" ]; } || { echo "!! .env thiếu POSTGRES_USER/DB/PASSWORD"; exit 1; }

mapfile -t FILES < <(ls -1t "$BACKUP_DIR"/vpp-backup-*.tar.gz* 2>/dev/null || true)
[ "${#FILES[@]}" -gt 0 ] || { echo "!! Không có bản backup nào trong $BACKUP_DIR"; exit 1; }
echo "Các bản backup VPP trong $BACKUP_DIR (mới → cũ):"
i=1
for f in "${FILES[@]}"; do
  sz=$(du -h "$f" 2>/dev/null | cut -f1); ts=$(date -r "$f" '+%Y-%m-%d %H:%M' 2>/dev/null || echo '?')
  printf "  [%2d] %s  (%s, %s)\n" "$i" "$(basename "$f")" "$ts" "${sz:-?}"; i=$((i+1))
done
echo
read -rp "Chọn SỐ bản để phục hồi (hoặc dán tên/đường dẫn file): " CHOICE
if [[ "$CHOICE" =~ ^[0-9]+$ ]]; then
  idx=$((CHOICE-1)); { [ "$idx" -ge 0 ] && [ "$idx" -lt "${#FILES[@]}" ]; } || { echo "!! Số không hợp lệ."; exit 1; }
  ARCHIVE="${FILES[$idx]}"
elif [ -f "$CHOICE" ]; then ARCHIVE="$CHOICE"
elif [ -f "$BACKUP_DIR/$CHOICE" ]; then ARCHIVE="$BACKUP_DIR/$CHOICE"
else echo "!! Không thấy file: $CHOICE"; exit 1; fi

echo "Phục hồi TỪ : $ARCHIVE"
echo "⚠️  Sẽ DROP database '$PGDB' và GHI ĐÈ file upload từ backup này."
read -rp "Gõ đúng chữ RESTORE để tiếp tục: " ok
[ "$ok" = "RESTORE" ] || { echo "Đã hủy."; exit 1; }

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT

echo "==> [1/6] Giải nén…"
case "$ARCHIVE" in
  *.enc)
    [ -n "$PASS" ] || { echo "!! Bản .enc cần BACKUP_PASSPHRASE trong .env"; exit 1; }
    export BACKUP_PASSPHRASE="$PASS"
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$ARCHIVE" | tar -xzf - -C "$WORK" ;;
  *) tar -xzf "$ARCHIVE" -C "$WORK" ;;
esac
[ -f "$WORK/db.sql" ] || { echo "!! Backup thiếu db.sql — dừng."; exit 1; }

echo "==> [2/6] Dừng app để cắt kết nối DB…"
"${C[@]}" stop api web backup-cron 2>/dev/null || true

echo "==> [3/6] Đảm bảo postgres chạy…"
"${C[@]}" up -d postgres
until "${C[@]}" ps postgres | grep -q healthy; do sleep 2; done

echo "==> [4/6] Tạo lại database $PGDB (FORCE cắt kết nối còn sót)…"
"${C[@]}" exec -T -e PGPASSWORD="$PGPW" postgres \
  psql -h 127.0.0.1 -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS $PGDB WITH (FORCE);" -c "CREATE DATABASE $PGDB OWNER $PGUSER;"

echo "==> [5/6] Nạp db.sql (ON_ERROR_STOP=1)…"
cat "$WORK/db.sql" | "${C[@]}" exec -T -e PGPASSWORD="$PGPW" postgres \
  psql -h 127.0.0.1 -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=1

if [ -d "$WORK/files" ]; then
  echo "==> [6/6] Nạp lại file upload vào volume filesdata…"
  "${C[@]}" run --rm --no-deps -v "$WORK/files:/src:ro" --entrypoint sh api \
    -c 'set -e; find /data/files -mindepth 1 -delete; cp -r /src/. /data/files/' \
    || { echo "!! Nạp lại file upload THẤT BẠI — DB đã phục hồi nhưng ảnh chưa; xử lý tay trước khi mở lại app." >&2; exit 1; }
else
  echo "==> [6/6] (backup không có thư mục files — bỏ qua)"
fi

echo "==> Khởi động lại VPP…"
"${C[@]}" up -d --build

echo
echo "XONG restore VPP. Kiểm: curl -sk -H 'Host: de-vpp.pmh.com.vn' https://localhost:8443/api/health"
