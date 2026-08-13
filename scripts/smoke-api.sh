#!/usr/bin/env bash
#
# Smoke test API qua HTTP thật, chạy đúng luồng người dùng: đăng nhập SSO →
# đăng ký → duyệt → giao → báo cáo → danh bạ → webhook.
#
# Cần stack đang chạy:
#   docker compose -f deploy/docker-compose.yml --profile app up -d
#   pnpm smoke:api
#
# Chạy với cấu hình khác (vd chế độ dev trên máy — README "Cách 2"):
#   API_URL=http://localhost:8090 IDP_URL=http://localhost:9000 pnpm smoke:api
#
# LƯU Ý: script GHI dữ liệu thật (tạo đơn, khoá/mở user demo) — chỉ dùng cho môi
# trường dev/demo, không chạy vào CSDL thật.
set -u
# Mặc định trỏ vào stack Docker demo: app vào qua nginx của web ở cổng 8100,
# api KHÔNG publish cổng riêng (từ M5).
API=${API_URL:-http://localhost:8100}
IDP=${IDP_URL:-http://localhost:9100}

# Làm việc trong thư mục tạm riêng để không rác hoá repo.
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

ok=0; fail=0
check() { # $1 = mô tả, $2 = mong đợi, $3 = thực tế
  if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "  ✓ $1"
  else fail=$((fail+1)); echo "  ✗ $1 — mong '$2', nhận '$3'"; fi
}

login() { # $1 = jar, $2 = sub
  U=$(curl -s -L -c "$1" -b "$1" -w "%{url_effective}" -o /dev/null "$API/api/auth/login" \
      | sed -n 's|.*/interaction/\([^/?]*\).*|\1|p')
  curl -s -L -c "$1" -b "$1" -d "sub=$2" -o /dev/null "$IDP/interaction/$U/login"
}

code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
json() { curl -s "$@"; }

# Quy tắc "1 đơn hiệu lực/người/kỳ" khiến lần chạy thứ hai không tạo được đơn nữa,
# và đơn đã duyệt thì KHÔNG có API nào xoá được (lịch sử giữ vô thời hạn — đúng thiết kế).
# Vì vậy dọn thẳng ở CSDL dev, nhưng CHỈ đơn của tài khoản mà script dùng —
# giữ nguyên dữ liệu demo của những người khác để màn quản trị vẫn có gì để xem.
echo "── Dọn đơn của tài khoản dùng để kiểm thử ───────────────"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'vpp-postgres'; then
  docker exec vpp-postgres psql -U vpp -d vpp -q -c "
    DELETE FROM request_items WHERE request_id IN (
      SELECT r.id FROM requests r JOIN users u ON u.id = r.user_id WHERE u.pmh_sub = 'usr_admin');
    DELETE FROM requests WHERE user_id IN (SELECT id FROM users WHERE pmh_sub = 'usr_admin');
  " > /dev/null 2>&1
  echo "  ✓ đã dọn đơn của usr_admin (dữ liệu demo của người khác giữ nguyên)"
else
  echo "  ⊘ không thấy container vpp-postgres — bỏ qua;"
  echo "    nếu tài khoản admin đã có đơn của kỳ này thì nhánh 'tạo đơn' sẽ báo hỏng."
fi

echo "── Đăng nhập ────────────────────────────────────────────"
login jar-admin.txt usr_admin
login jar-nv.txt    usr_chi
check "admin nhận đúng vai trò" "admin" "$(json -b jar-admin.txt "$API/api/me" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).role))")"
check "nhân viên nhận đúng phòng ban" "Kỹ thuật" "$(json -b jar-nv.txt "$API/api/me" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).department))")"

echo "── Danh mục ─────────────────────────────────────────────"
json -b jar-nv.txt "$API/api/catalog" > cat.json
node -e "
const c=require('./cat.json'), f=c.flatMap(g=>g.items);
require('fs').writeFileSync('ids.json', JSON.stringify({
  but: f.find(i=>i.name.startsWith('Bút bi xanh')).id,
  so:  f.find(i=>i.name.startsWith('Sổ tay')).id,
  a4:  f.find(i=>i.adminOnly).id,
}));"
check "danh mục có 5 nhóm" "5" "$(node -e "process.stdout.write(String(require('./cat.json').length))")"
check "danh mục có 25 món" "25" "$(node -e "process.stdout.write(String(require('./cat.json').flatMap(g=>g.items).length))")"

BUT=$(node -e "process.stdout.write(require('./ids.json').but)")
SO=$(node -e "process.stdout.write(require('./ids.json').so)")
A4=$(node -e "process.stdout.write(require('./ids.json').a4)")

echo "── Quy tắc chặn khi tạo đơn ─────────────────────────────"
node -e "require('fs').writeFileSync('r-a4.json', JSON.stringify({lines:[{itemId:'$A4',quantity:1}]}))"
node -e "require('fs').writeFileSync('r-qty.json',JSON.stringify({lines:[{itemId:'$BUT',quantity:99}]}))"
node -e "require('fs').writeFileSync('r-empty.json',JSON.stringify({lines:[]}))"
H='Content-Type: application/json'
# Hôm nay ngoài ngày 1–10 nên nhân viên bị chặn bởi cửa sổ trước tiên.
check "NV gửi ngoài cửa sổ 1–10 bị chặn" "400" "$(code -b jar-nv.txt -X POST -H "$H" --data-binary @r-a4.json "$API/api/requests")"
check "admin: đơn rỗng bị chặn"          "400" "$(code -b jar-admin.txt -X POST -H "$H" --data-binary @r-empty.json "$API/api/requests")"
check "admin: SL vượt 20 bị chặn"        "400" "$(code -b jar-admin.txt -X POST -H "$H" --data-binary @r-qty.json "$API/api/requests")"

echo "── Vòng đời đơn ─────────────────────────────────────────"
node -e "require('fs').writeFileSync('r-ok.json', JSON.stringify({note:'Đơn thử M2',lines:[{itemId:'$BUT',quantity:5},{itemId:'$SO',quantity:2},{itemId:'$A4',quantity:1}]}))"
json -b jar-admin.txt -X POST -H "$H" --data-binary @r-ok.json "$API/api/requests" > req.json
RID=$(node -e "process.stdout.write(require('./req.json').id)")
check "tạo đơn thành công"     "submitted" "$(node -e "process.stdout.write(require('./req.json').status)")"
check "mã đơn đúng định dạng"  "1"         "$(node -e "process.stdout.write(/^VPP-\d{4}-\d{2}-\d{4}\$/.test(require('./req.json').code)?'1':'0')")"
check "đơn có 3 dòng"          "3"         "$(node -e "process.stdout.write(String(require('./req.json').items.length))")"
check "trùng đơn trong kỳ"     "409"       "$(code -b jar-admin.txt -X POST -H "$H" --data-binary @r-ok.json "$API/api/requests")"
check "NV xem đơn người khác"  "403"       "$(code -b jar-nv.txt "$API/api/requests/$RID")"
check "giao khi chưa duyệt"    "409"       "$(code -b jar-admin.txt -X POST "$API/api/admin/requests/$RID/deliver-all")"
check "NV gọi API admin"       "403"       "$(code -b jar-nv.txt "$API/api/admin/requests")"

json -b jar-admin.txt -X POST "$API/api/admin/requests/$RID/approve" > ap.json
check "duyệt đơn" "approved" "$(node -e "process.stdout.write(require('./ap.json').status)")"
check "duyệt lại lần 2 bị chặn" "409" "$(code -b jar-admin.txt -X POST "$API/api/admin/requests/$RID/approve")"

json -b jar-admin.txt -X POST "$API/api/admin/requests/$RID/deliver-all" > dl.json
check "giao toàn bộ ⇒ đơn delivered" "delivered" "$(node -e "process.stdout.write(require('./dl.json').status)")"
json -b jar-admin.txt -X POST "$API/api/admin/requests/$RID/undeliver-all" > ud.json
check "hoàn tác ⇒ về approved" "approved" "$(node -e "process.stdout.write(require('./ud.json').status)")"

echo "── Upload ảnh ───────────────────────────────────────────"
node -e "require('fs').writeFileSync('a.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'))"
node -e "require('fs').writeFileSync('a.txt','x')"
UP=$(json -b jar-nv.txt -F "file=@a.png;type=image/png" "$API/api/uploads")
check "upload ảnh hợp lệ" "1" "$(node -e "process.stdout.write(/^\/api\/uploads\/[0-9a-f-]{36}\.png\$/.test(JSON.parse(process.argv[1]).path)?'1':'0')" "$UP")"
check "upload file text bị chặn" "400" "$(code -b jar-nv.txt -F "file=@a.txt;type=text/plain" "$API/api/uploads")"
# Phòng thủ thật của API: CHỈ phục vụ tên file đúng khuôn server sinh (uuid + đuôi).
# Không kiểm chuỗi "..%2F.." vì khi có nginx đứng trước, nó chuẩn hoá đường dẫn
# rồi mới proxy — request kiểu đó không bao giờ tới được API, nên phép kiểm ấy chỉ
# đo hành vi của proxy chứ không đo được app.
check "tên file lạ bị từ chối"   "404" "$(code -b jar-nv.txt "$API/api/uploads/khong-phai-uuid.png")"
check "đuôi file lạ bị từ chối"  "404" "$(code -b jar-nv.txt "$API/api/uploads/11111111-2222-3333-4444-555555555555.exe")"

echo "── Thông báo & audit ────────────────────────────────────"
check "admin có thông báo" "1" "$(json -b jar-admin.txt "$API/api/notifications" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).items.length>0?'1':'0'))")"
check "đọc tất cả ⇒ còn 0 chưa đọc" "0" "$(curl -s -b jar-admin.txt -X POST "$API/api/notifications/read-all" > /dev/null; json -b jar-admin.txt "$API/api/notifications" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(String(JSON.parse(d).unread)))")"
check "NV xem audit bị chặn" "403" "$(code -b jar-nv.txt "$API/api/admin/audit")"
check "audit có ghi hành động" "1" "$(json -b jar-admin.txt "$API/api/admin/audit" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).total>0?'1':'0'))")"

echo "── Báo cáo ──────────────────────────────────────────────"
check "tổng hợp theo món có dữ liệu" "1" "$(json -b jar-admin.txt "$API/api/admin/requests/summary" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).items.length>0?'1':'0'))")"
check "thống kê trả về theo kỳ" "1" "$(json -b jar-admin.txt "$API/api/admin/stats" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).byPeriod.length>0?'1':'0'))")"
curl -s -b jar-admin.txt -o bc.xlsx -D h.txt "$API/api/export/requests.xlsx"
check "xuất Excel trả file xlsx" "1" "$(node -e "const b=require('fs').readFileSync('bc.xlsx');process.stdout.write(b.length>5000&&b[0]===0x50&&b[1]===0x4b?'1':'0')")"
check "tên file đúng quy ước" "1" "$(grep -ci 'filename="bao-cao-vpp-....-...xlsx"' h.txt)"
check "NV xuất Excel bị chặn" "403" "$(code -b jar-nv.txt "$API/api/export/requests.xlsx")"

echo "── Danh bạ & webhook ────────────────────────────────────"
check "đồng bộ danh bạ" "6" "$(json -b jar-admin.txt -X POST "$API/api/admin/directory-sync" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(String(JSON.parse(d).upserted)))")"
check "danh bạ đủ 6 người" "6" "$(json -b jar-admin.txt "$API/api/admin/users" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(String(JSON.parse(d).total)))")"
check "có người chưa từng đăng nhập" "1" "$(json -b jar-admin.txt "$API/api/admin/users" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>process.stdout.write(JSON.parse(d).items.some(u=>!u.hasLoggedIn)?'1':'0'))")"

node -e "require('fs').writeFileSync('ev.json',JSON.stringify({event:'user.locked',sub:'usr_chi'}),'utf8')"
curl -s -X POST -H "$H" --data-binary @ev.json -o /dev/null "$IDP/admin/emit-webhook"
sleep 1
check "webhook khoá user ⇒ phiên bị huỷ" "401" "$(code -b jar-nv.txt "$API/api/me")"
check "webhook chữ ký sai bị từ chối" "400" "$(code -X POST -H "$H" -H "X-PMH-Timestamp: $(node -e 'process.stdout.write(String(Date.now()))')" -H "X-PMH-Signature-V2: deadbeef" --data-binary @ev.json "$API/api/webhooks/pmh-id")"

node -e "require('fs').writeFileSync('ev2.json',JSON.stringify({event:'user.unlocked',sub:'usr_chi'}),'utf8')"
curl -s -X POST -H "$H" --data-binary @ev2.json -o /dev/null "$IDP/admin/emit-webhook"

echo
echo "════════════════════════════════════════════════════════"
echo "  ĐẠT: $ok   ·   HỎNG: $fail"
# Thoát khác 0 khi có mục hỏng để dùng được trong pipeline.
[ "$fail" -eq 0 ]
