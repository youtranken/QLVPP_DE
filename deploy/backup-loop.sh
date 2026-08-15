#!/bin/sh
#
# Sao lưu CSDL DE-VPP hằng ngày. Chạy trong service `backup` của
# deploy/docker-compose.prod.yml — KHÔNG dùng để chạy tay trên máy
# (việc đó dùng scripts/backup-db.sh).
#
# Biến môi trường: POSTGRES_USER, POSTGRES_DB, PGPASSWORD, BACKUP_HOUR, BACKUP_KEEP.
set -u

BACKUP_DIR=/backups
HOUR=${BACKUP_HOUR:-2}
KEEP=${BACKUP_KEEP:-14}

sao_luu() {
  stamp=$(date +%Y%m%d-%H%M%S)
  out="$BACKUP_DIR/vpp-$stamp.sql.gz"

  # -Fp + gzip: dump dạng văn bản, khôi phục bằng psql mà không cần pg_restore.
  # Ghi ra file tạm rồi mới đổi tên: đứt giữa chừng sẽ để lại .partial thay vì một
  # file .sql.gz trông như bản sao lưu hợp lệ nhưng thực ra cụt.
  if pg_dump -h postgres -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
      --no-owner --no-privileges 2>/tmp/loi.txt | gzip > "$out.partial"; then
    mv "$out.partial" "$out"
    echo "$(date '+%F %T') sao lưu xong: $(basename "$out") ($(wc -c < "$out") byte)"
  else
    rm -f "$out.partial"
    echo "$(date '+%F %T') SAO LƯU THẤT BẠI: $(cat /tmp/loi.txt)" >&2
    return 1
  fi

  # Chỉ dọn khi bản mới đã ghi thành công — không bao giờ xoá bản cũ rồi mới phát
  # hiện bản mới hỏng.
  #
  # Sắp theo TÊN FILE (đã chứa mốc `YYYYMMDD-HHMMSS`) chứ không theo thời gian sửa
  # file: chép bản sao lưu từ máy khác về hay khôi phục lại thư mục đều làm mtime
  # mới tinh, và khi đó sắp theo mtime sẽ xoá đúng những bản cũ cần giữ.
  ls -1 "$BACKUP_DIR"/vpp-*.sql.gz 2>/dev/null | sort -r | tail -n +$((KEEP + 1)) | while read -r cu; do
    rm -f "$cu"
    echo "$(date '+%F %T') đã xoá bản cũ: $(basename "$cu")"
  done
}

# Chạy một lần ngay khi khởi động: chứng minh cấu hình đúng ngay lúc triển khai,
# thay vì đến 2 giờ sáng mới biết là sai mật khẩu.
echo "$(date '+%F %T') khởi động — sao lưu lúc ${HOUR}:00 hằng ngày, giữ $KEEP bản"
sao_luu || true

while true; do
  # Ngủ tới đúng giờ hẹn kế tiếp. Tính bằng số giây trong ngày để không phụ thuộc
  # `date -d` (busybox không có đủ như GNU date).
  now=$(( $(date +%H) * 3600 + $(date +%M) * 60 + $(date +%S) ))
  hen=$(( HOUR * 3600 ))
  cho=$(( (hen - now + 86400) % 86400 ))
  [ "$cho" -eq 0 ] && cho=86400
  sleep "$cho"
  sao_luu || true
done
