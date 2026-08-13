#!/usr/bin/env bash
#
# Sao lưu CSDL DE-VPP. Chạy thủ công hoặc đặt lịch cron/Task Scheduler.
#
#   bash scripts/backup-db.sh                    # dùng container prod
#   CONTAINER=vpp-postgres bash scripts/backup-db.sh   # sao lưu stack demo
#
# Ảnh đính kèm nằm ở volume Docker riêng — xem phần "Sao lưu ảnh" trong
# docs/operations/RUNBOOK.md, script này CHỈ lo phần CSDL.
set -euo pipefail

CONTAINER=${CONTAINER:-vpp-prod-postgres}
DB_USER=${POSTGRES_USER:-vpp}
DB_NAME=${POSTGRES_DB:-vpp}
BACKUP_DIR=${BACKUP_DIR:-deploy/backups}
# Giữ bao nhiêu bản gần nhất; các bản cũ hơn sẽ bị xoá.
KEEP=${KEEP:-14}

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Không thấy container '$CONTAINER' đang chạy." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$BACKUP_DIR/vpp-$STAMP.sql.gz"

echo "Đang sao lưu $DB_NAME từ $CONTAINER …"
# -Fp + gzip: dump dạng văn bản, khôi phục được bằng psql mà không cần pg_restore.
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges \
  | gzip -9 > "$OUT"

SIZE=$(du -h "$OUT" | cut -f1)
echo "✓ Đã ghi $OUT ($SIZE)"

# Dọn bản cũ, giữ $KEEP bản mới nhất.
mapfile -t OLD < <(ls -1t "$BACKUP_DIR"/vpp-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) || true)
if [ ${#OLD[@]} -gt 0 ]; then
  printf '%s\n' "${OLD[@]}" | xargs rm -f
  echo "✓ Đã xoá ${#OLD[@]} bản sao lưu cũ (giữ $KEEP bản)"
fi
