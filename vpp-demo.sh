#!/usr/bin/env bash
# Công cụ buổi demo trên prod: chốt kỳ ngay, mở lại kỳ, clear đơn hàng, clear tất cả.
# Chạy: bash vpp-demo.sh            (hiện menu)
#       bash vpp-demo.sh 1          (chọn thẳng một mục)
# Mọi thao tác hỏi xác nhận; clear luôn sao lưu DB + ảnh trước khi xóa.
set -euo pipefail

VPP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$VPP"

# Prod chỉ dùng docker-compose.yml (không override dev); thử trên dev thì đặt VPP_COMPOSE="docker compose"
DC=${VPP_COMPOSE:-"docker compose -f docker-compose.yml"}
FILES_DIR=${VPP_FILES_DIR:-/data/files}
BACKUP_DIR=${VPP_BACKUP_DIR:-$HOME}

env_val() { sed -n "s/^$1=//p" .env | tail -1 | tr -d '"'"'"; }
DB_USER=$(env_val POSTGRES_USER)
DB_NAME=${VPP_DB:-$(env_val POSTGRES_DB)}
[[ -n "$DB_USER" && -n "$DB_NAME" ]] || { echo "!! Không đọc được POSTGRES_USER/POSTGRES_DB trong .env" >&2; exit 1; }

# </dev/null: docker exec -T chuyển stdin vào container, không chặn thì nó nuốt mất chữ xác nhận người dùng gõ
sql() { $DC exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -qtA -c "$1" </dev/null; }
sql_file() { $DC exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q; }

confirm() {
  local ans
  read -r -p "    Làm không? [y/N]: " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]] || { echo "    Đã thôi, không đổi gì."; exit 0; }
}

backup() {
  local stamp; stamp=$(date +%Y%m%d-%H%M%S)
  local db="$BACKUP_DIR/vpp-truoc-clear-$stamp.dump" files="$BACKUP_DIR/vpp-anh-truoc-clear-$stamp.tar"
  echo "==> Sao lưu DB → $db"
  $DC exec -T postgres pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$db" </dev/null
  [[ -s "$db" ]] || { echo "!! Sao lưu DB rỗng — dừng, chưa xóa gì." >&2; exit 1; }
  echo "==> Sao lưu ảnh → $files"
  $DC exec -T api tar -C "$FILES_DIR" -cf - . > "$files" </dev/null
  [[ -s "$files" ]] || { echo "!! Sao lưu ảnh rỗng — dừng, chưa xóa gì." >&2; exit 1; }
  echo "    Khôi phục nếu cần: xem phần 'Khôi phục' trong docs/van-hanh-demo.md"
}

# Xóa tệp ảnh trên đĩa theo danh sách id (một id mỗi dòng từ stdin)
remove_files() {
  $DC exec -T api sh -c "while read -r id; do if [ -n \"\$id\" ]; then rm -f \"$FILES_DIR/\$id\".*; fi; done"
}

open_period() { sql "SELECT to_char(ym,'YYYY-MM')||'|'||to_char(deadline AT TIME ZONE 'Asia/Ho_Chi_Minh','HH24:MI DD/MM/YYYY') FROM periods WHERE deadline > now() ORDER BY ym LIMIT 1;"; }

lock_now() {
  local row; row=$(open_period)
  [[ -n "$row" ]] || { echo "!! Chưa có kỳ đang mở trong DB (chưa ai mở app tháng này). Mở app một lần rồi chạy lại." >&2; exit 1; }
  local ym=${row%%|*} at=${row#*|}
  local n; n=$(sql "SELECT count(*) FROM requests WHERE period_ym = '$ym-01';")
  echo "==> Chốt kỳ tháng $ym NGAY BÂY GIỜ (hạn hiện tại $at, đang có $n phiếu)."
  echo "    Nhân viên sẽ không sửa phiếu kỳ này nữa; kỳ tháng sau tự mở đăng ký."
  confirm
  sql_file <<SQL
BEGIN;
INSERT INTO audit_log (actor, action, object_type, object_id, detail)
SELECT 'system', 'period.locked_early', 'period', '$ym',
       jsonb_build_object('before', deadline, 'after', now(), 'by', 'vpp-demo.sh')
FROM periods WHERE ym = '$ym-01' AND deadline > now();
UPDATE periods SET deadline = now() WHERE ym = '$ym-01' AND deadline > now();
COMMIT;
SQL
  echo "    Đã chốt kỳ $ym."
  echo "    Chuông 'kỳ đã khóa' + chụp số người: tự chạy ở phút 5 của giờ kế tiếp."
  local ans; read -r -p "    Gửi chuông ngay bây giờ? (khởi động lại api ~10 giây, người đang dùng thấy chập chờn) [y/N]: " ans
  if [[ "$ans" == "y" || "$ans" == "Y" ]]; then
    $DC restart api >/dev/null </dev/null && echo "    Đã khởi động lại api — lịch chạy một lượt khi api lên."
  fi
}

reopen() {
  local row; row=$(sql "SELECT a.object_id||'|'||(a.detail->>'before') FROM audit_log a JOIN periods p ON p.ym = (a.object_id||'-01')::date WHERE a.action = 'period.locked_early' AND p.deadline <= now() ORDER BY a.created_at DESC LIMIT 1;")
  [[ -n "$row" ]] || { echo "!! Không có kỳ nào được chốt bằng script này đang khóa — không có gì để mở lại." >&2; exit 1; }
  local ym=${row%%|*} before=${row#*|}
  local late; late=$(sql "SELECT ('$before'::timestamptz <= now())::text;")
  [[ "$late" == "false" ]] || { echo "!! Hạn gốc của kỳ $ym đã qua thật — không mở lại được." >&2; exit 1; }
  local later; later=$(sql "SELECT count(*) FROM requests WHERE period_ym > '$ym-01';")
  [[ "$later" == "0" ]] || { echo "!! Kỳ sau kỳ $ym đã có $later phiếu — mở lại sẽ lẫn hai kỳ. Dừng." >&2; exit 1; }
  echo "==> Mở lại kỳ tháng $ym, hạn trở về $(sql "SELECT to_char('$before'::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh','HH24:MI DD/MM/YYYY');")."
  echo "    Phiếu giữ nguyên; xóa chuông 'kỳ đã khóa' của kỳ này để lần chốt sau gửi lại."
  confirm
  sql_file <<SQL
BEGIN;
UPDATE periods SET deadline = '$before'::timestamptz, headcount = NULL, headcount_subs = NULL WHERE ym = '$ym-01';
DELETE FROM in_app_notifications WHERE event_id = 'period_locked:$ym';
INSERT INTO audit_log (actor, action, object_type, object_id, detail)
VALUES ('system', 'period.reopened', 'period', '$ym', jsonb_build_object('deadline', '$before'::timestamptz, 'by', 'vpp-demo.sh'));
COMMIT;
SQL
  echo "    Đã mở lại kỳ $ym. Nhân viên tải lại trang là sửa phiếu được."
}

# Sổ điều chỉnh có trigger chặn TRUNCATE (append-only): tắt rồi bật lại trong cùng transaction, lỗi thì hoàn tác cả hai
ORDER_TABLES="line_deliveries, stock_movements, request_line_adjustments, request_lines, requests, custom_receipts, period_adm_out, report_snapshots, periods, in_app_notifications"

clear_orders() {
  echo "==> CLEAR ĐƠN HÀNG: xóa mọi phiếu, điều chỉnh, giao/nhận hàng, báo cáo, thông báo, sổ nhập xuất, ảnh món ngoài danh mục, các kỳ; số trong tủ về 0."
  echo "    Giữ: món, nhóm, đơn vị tính, ảnh món, Danh bạ, Cấu hình, Nhật ký."
  echo "    Đang có: $(sql "SELECT count(*) FROM requests;") phiếu, $(sql "SELECT count(*) FROM stock_movements;") dòng nhập xuất."
  confirm
  backup
  # Ảnh dòng ngoài DM đã thành ảnh món khi thêm vào danh mục thì món còn dùng — giữ lại
  local keep="purpose = 'line_image' AND id NOT IN (SELECT image_file_id FROM items WHERE image_file_id IS NOT NULL)"
  local ids; ids=$(sql "SELECT id FROM files WHERE $keep;")
  sql_file <<SQL
BEGIN;
ALTER TABLE request_line_adjustments DISABLE TRIGGER request_line_adjustments_no_truncate;
TRUNCATE $ORDER_TABLES;
ALTER TABLE request_line_adjustments ENABLE TRIGGER request_line_adjustments_no_truncate;
DELETE FROM files WHERE $keep;
UPDATE items SET stock_qty = 0, low_stock_notified_at = NULL;
INSERT INTO audit_log (actor, action, object_type, detail) VALUES ('system', 'demo.cleared', 'system', jsonb_build_object('mode', 'orders', 'by', 'vpp-demo.sh'));
COMMIT;
SQL
  printf '%s\n' "$ids" | remove_files
  echo "    Đã clear đơn hàng. Kỳ đang mở tự tạo lại khi có người mở app."
}

clear_all() {
  echo "==> CLEAR TẤT CẢ: như clear đơn hàng, thêm xóa mọi món, nhóm, đơn vị tính và mọi ảnh."
  echo "    Giữ: Danh bạ, Cấu hình, phiên đăng nhập, Nhật ký. Sau đó Adm D&E phải nhập lại danh mục."
  echo "    Đang có: $(sql "SELECT count(*) FROM items;") món, $(sql "SELECT count(*) FROM requests;") phiếu."
  confirm
  backup
  local ids; ids=$(sql "SELECT id FROM files;")
  sql_file <<SQL
BEGIN;
ALTER TABLE request_line_adjustments DISABLE TRIGGER request_line_adjustments_no_truncate;
TRUNCATE $ORDER_TABLES, items, item_categories, units, files;
ALTER TABLE request_line_adjustments ENABLE TRIGGER request_line_adjustments_no_truncate;
INSERT INTO audit_log (actor, action, object_type, detail) VALUES ('system', 'demo.cleared', 'system', jsonb_build_object('mode', 'all', 'by', 'vpp-demo.sh'));
COMMIT;
SQL
  printf '%s\n' "$ids" | remove_files
  echo "    Đã clear tất cả."
}

choice=${1:-}
if [[ -z "$choice" ]]; then
  echo "VPP — công cụ demo (DB: $DB_NAME)"
  echo "  1) Chốt kỳ ngay"
  echo "  2) Mở lại kỳ vừa chốt (kỳ tháng sau tự mở khi chốt, không cần lệnh)"
  echo "  3) Clear đơn hàng (giữ danh mục)"
  echo "  4) Clear tất cả"
  read -r -p "Chọn 1-4: " choice
fi
case "$choice" in
  1) lock_now ;;
  2) reopen ;;
  3) clear_orders ;;
  4) clear_all ;;
  *) echo "Chọn 1, 2, 3 hoặc 4." >&2; exit 1 ;;
esac
