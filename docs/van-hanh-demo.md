# Công cụ demo trên prod — `vpp-demo.sh`

Dùng cho buổi demo với nhân viên: chốt kỳ ngay không cần đợi ngày hạn, mở lại kỳ để diễn tập, và xóa dữ liệu demo sau buổi. Chạy trên máy prod, trong thư mục repo:

```bash
cd ~/QLVPP_DE
bash vpp-demo.sh
```

```
VPP — công cụ demo (DB: vpp)
  1) Chốt kỳ ngay
  2) Mở lại kỳ vừa chốt
  3) Clear đơn hàng (giữ danh mục)
  4) Clear tất cả
Chọn 1-4:
```

Có thể chọn thẳng: `bash vpp-demo.sh 1`. Mọi lựa chọn in ra sẽ làm gì rồi hỏi `[y/N]`: gõ `y` để làm, Enter hoặc phím khác là thôi, không đổi gì.

| Chọn | Làm gì |
|---|---|
| 1 Chốt kỳ ngay | Kỳ đang mở (script tự tìm, không cần gõ tháng) khóa ngay. Nhân viên không sửa phiếu được nữa; kỳ tháng sau tự mở đăng ký. Hỏi thêm `[y/N]` có gửi chuông "kỳ đã khóa" ngay không (khởi động lại api khoảng 10 giây); không thì chuông tự tới ở phút 5 của giờ kế tiếp. |
| 2 Mở lại kỳ vừa chốt | Mở lại chính kỳ vừa chốt (không phải kỳ tháng sau — kỳ sau tự mở khi chốt). Đưa hạn của kỳ vừa chốt bằng lựa chọn 1 về như cũ, phiếu giữ nguyên, xóa chuông "kỳ đã khóa" để lần chốt sau gửi lại. Dừng nếu kỳ sau đã có người đăng ký hoặc hạn gốc đã qua thật. |
| 3 Clear đơn hàng | Sao lưu trước, rồi xóa mọi phiếu, điều chỉnh, giao/nhận hàng, báo cáo, thông báo, sổ nhập xuất, ảnh món ngoài danh mục, các kỳ; số trong tủ mọi món về 0. Giữ món, nhóm, đơn vị tính, ảnh món, Danh bạ, Cấu hình, Nhật ký. |
| 4 Clear tất cả | Như 3, thêm xóa mọi món, nhóm, đơn vị tính và mọi ảnh. Giữ Danh bạ, Cấu hình, phiên đăng nhập, Nhật ký. Sau đó Adm D&E nhập lại danh mục. |

Mỗi thao tác ghi một dòng Nhật ký (`period.locked_early`, `period.reopened`, `demo.cleared`).

## Kịch bản demo gợi ý

1. Trước buổi demo: nhân viên đăng ký phiếu tháng này như thường.
2. Trong buổi: `bash vpp-demo.sh 1` → `y` → `y` (gửi chuông ngay). Nhân viên tải lại trang thấy kỳ đã khóa, kỳ sau đang mở; Adm D&E vào Kỳ tháng điều chỉnh, gửi NCC, nhận và giao hàng.
3. Muốn làm lại phần đăng ký: `bash vpp-demo.sh 2` → `y` (chỉ được khi chưa ai đăng ký kỳ sau).
4. Sau buổi demo: `bash vpp-demo.sh 3` (giữ danh mục) hoặc `4` (xóa sạch).

## Sao lưu và khôi phục

Lựa chọn 3 và 4 luôn sao lưu trước khi xóa, vào thư mục nhà:

- `~/vpp-truoc-clear-<ngày-giờ>.dump` — toàn bộ DB
- `~/vpp-anh-truoc-clear-<ngày-giờ>.tar` — toàn bộ ảnh

Sao lưu rỗng thì script dừng, chưa xóa gì. Khôi phục (thay `<ngày-giờ>` bằng tên tệp thật):

```bash
cd ~/QLVPP_DE
docker compose -f docker-compose.yml stop api
docker compose -f docker-compose.yml exec -T postgres pg_restore -U vpp -d vpp --clean --if-exists < ~/vpp-truoc-clear-<ngày-giờ>.dump
docker compose -f docker-compose.yml start api
docker compose -f docker-compose.yml exec -T api tar -C /data/files -xf - < ~/vpp-anh-truoc-clear-<ngày-giờ>.tar
```

(`vpp` là `POSTGRES_USER` / `POSTGRES_DB` trong `.env`; khác thì đổi theo.)

## Thử trên dev

Không chạy thẳng trên DB dev đang dùng. Chép ra DB riêng rồi trỏ script vào:

```bash
VPP_COMPOSE="docker compose" VPP_DB=vpp_demo_test VPP_FILES_DIR=/tmp/vpp-demo-files VPP_BACKUP_DIR=/tmp bash vpp-demo.sh
```
