# VPP Công trình — hệ thị giác đã chốt (2026-10-28)

> Bản chốt nằm trong `final/`: `member.html`, `admin.html`, `login.html`, `tokens.css`. Các thư mục/tệp khác (`01-…html`, `styles/`) là phương án đã xem, giữ để đối chiếu.

## Nguyên tắc
- **Hai giao diện, một thương hiệu.** Nhân viên dùng trang đặt món kiểu app; Hành chính dùng phần mềm quản lý. Cùng màu xanh ngọc lục, cùng bộ nhãn trạng thái, cùng từ ngữ.
- Khác hẳn PMH ID (xanh lục thẫm + vàng đồng) và QLTS (xanh dương + navy).
- Phẳng: không gradient trang trí; bóng chỉ dùng cho thẻ ở giao diện nhân viên.

## Token (`final/tokens.css`)
| Vai trò | Giá trị |
|---|---|
| Thương hiệu / đậm / nhạt / chữ trên nhạt | `#059669` / `#047857` / `#E6F6EF` / `#065F46` |
| Nền / thẻ / thẻ phụ | `#F4F7F5` / `#FFFFFF` / `#F7FAF8` |
| Mực / mực phụ / mực mờ | `#14231C` / `#51645B` / `#667A70` (≥ 4.5:1 trên trắng; `#8A9A92` chỉ dùng cho viền/icon trang trí) |
| Viền / viền đậm | `#DFE7E2` / `#C9D5CE` |
| Sidebar admin (nền / chữ) | `#0F2A21` / `#B7CFC4` |
| Trạng thái ok / warn / danger / info | `#047857` / `#B45309` / `#B91C1C` / `#1D4ED8` (kèm nền nhạt) |
| Màu nhóm món (ô ảnh thẻ) | xanh da trời `#E0F2FE`, vàng `#FEF3C7`, xanh lục `#D1FAE5`, tím `#EDE9FE` |
| Font nhân viên / admin | **Nunito** 500/700/800 · **IBM Plex Sans** 400/500/600 |
| Bo góc nhân viên / admin | thẻ 18 · nút 999 (tròn) / thẻ 8 · nút 6 |
| Focus | vòng `0 0 0 3px rgba(5,150,105,.35)` |

## Giao diện nhân viên (`final/member.html`)
- Thanh trên 64 px: logo ô vuông xanh chữ V · tab "Đăng ký", "Lịch sử" dạng viên · chuông · avatar.
- **Hero xanh**: tiêu đề kỳ, mô tả, **ô trắng số ngày còn lại**, nút trắng "Lấy lại tháng trước". Khi khóa: nền xanh đậm `#0F2A21`, ô số thành "2/4 món đã giao".
- Hàng chip: ô tìm + nhóm món (chip chọn = viền xanh nền nhạt), cuộn ngang trên điện thoại.
- Lưới thẻ `minmax(200px,1fr)`: ô ảnh vuông màu theo nhóm, tên đậm, "đơn vị · tối đa n", **stepper viên** (−/+ xanh). Thẻ đã chọn: viền xanh, stepper nền xanh nhạt. Khi khóa: stepper → dòng "Đã đăng ký n".
- **Giỏ đăng ký** (360 px, dính): tên/phòng ban, dòng có icon màu nhóm + viên số lượng, dòng ngoài danh mục có nhãn info, tổng, nút viền đứt "Thêm món ngoài danh mục", **nút xanh lớn "Lưu đăng ký"**. Khi khóa: thanh tiến độ xanh từng dòng, hộp hướng dẫn liên hệ Hành chính.
- Hộp xác nhận: tiêu đề "Lưu phiếu tháng N?", bảng món, "Xem lại" / "Lưu phiếu".
- ≤ 900 px: lưới 2 cột, giỏ xuống dưới, **thanh dính dưới** "N món · Lưu đăng ký".

## Giao diện Hành chính (`final/admin.html`)
- Sidebar 224 px nền `#0F2A21`: nhóm *Hằng tháng* (Tổng hợp kỳ · Món ngoài danh mục · Giao hàng · Còn nợ · Báo cáo & in), *Kho & danh mục* (Kho · Danh mục), *Hệ thống* (Danh bạ · Nhật ký · Cấu hình), *Cá nhân* (Phiếu của tôi ↗). Mục đang chọn: nền sáng 10 % + vạch xanh trái; số đếm viên xanh.
- Đầu trang 52 px: tiêu đề, chọn tháng ‹ ›, nhãn trạng thái kỳ, nút "Xuất Excel", nút xanh "In trình ký".
- KPI 4 ô bấm-để-lọc; ô đang lọc viền xanh. Số màu cảnh báo/đỏ theo nghĩa.
- Bảng: đầu bảng nền phụ, nhóm theo tổ (hàng xám), thanh tiến độ giao 72 px, nhãn trạng thái, nút "Giao" / "Điều chỉnh".
- Ngăn điều chỉnh 520 px: dòng đã sửa nền xanh nhạt + giá trị cũ gạch; khối món ngoài danh mục viền đứt với 3 nút "Chấp nhận" / "Thêm vào danh mục" / "Từ chối…"; ô "Lý do điều chỉnh" (bắt buộc khi kỳ khóa); chân "Hủy" / "Lưu điều chỉnh".

## Đăng nhập (`final/login.html`)
Nền xanh nhạt; thẻ hai cột bo 24: trái nền xanh (nhãn PMH, tiêu đề, mô tả, kệ icon), phải trắng (Email công ty → "Tiếp tục với PMH ID", gợi ý SSO, ghi chú quyền và đường vào SA). ≤ 760 px xếp dọc.

## Câu chữ
Chủ động, thường, nói rõ kết quả: "Lưu đăng ký", "Lấy lại tháng 10", "Tiếp tục với PMH ID", "Thêm vào danh mục". Lỗi nêu chuyện gì và làm gì tiếp. Trong UI gọi vai admin là **Hành chính**.

## Thay đổi sau review (2026-10-28) — nguồn đúng khi làm FE, mockup `final/*.html` chưa cập nhật
- **Điện thoại (≤ 900 px):** thanh điều hướng dưới 3 mục *Đăng ký · Lịch sử · Tôi* (icon + nhãn, 56 px, nền trắng, viền trên); tab trên ẩn. Thanh dính "N món · Lưu đăng ký" nằm ngay trên thanh điều hướng. "Tôi" = hồ sơ, đổi ngôn ngữ, đăng xuất.
- **Nút thêm món ngoài danh mục:** viên viền đứt "Thêm món khác" bên phải ô tìm (desktop) / dưới hàng chip (điện thoại), và một thẻ cuối lưới "Không thấy món cần? Thêm tại đây". Dòng ngoài danh mục trong giỏ có −/+ và ×, có ô ĐVT (chọn từ danh sách).
- **Trạng thái lưu:** hero hiện "Đã lưu 14:20 · sửa tiếp đến hết 10/11" (hoặc "Chưa lưu phiếu tháng này"); khi có thay đổi: nút chính đổi thành "2 thay đổi chưa lưu · Lưu", hero thêm chấm vàng; sau lưu: toast "Đã lưu phiếu tháng 11" 3 s; rời trang khi còn thay đổi → cảnh báo trình duyệt.
- **Dòng Hành chính thêm:** trong giỏ hiện nhãn xám "Hành chính thêm", không có −/+/×, tooltip "Dòng này do Hành chính thêm, liên hệ nếu cần sửa".
- **Thẻ "kỳ trước đang giao":** khi phiếu kỳ trước chưa giao đủ, dưới hero có thẻ nhỏ "Tháng 11 đang giao · 2/4 món" → Lịch sử.
- **Hộp xác nhận:** "Lưu phiếu tháng 11?" · bảng món · "Quay lại sửa" / "Lưu phiếu". Dòng tổng: "4 loại món · 17 đơn vị".
- **Câu chữ:** "tối đa 20/tháng" (bỏ "Còn nhiều"); nút chép: "Chép lại danh sách tháng 10" (icon tài liệu, không dùng ↺); thống nhất gọi "phiếu" (nút "Lưu phiếu", tiêu đề "Phiếu tháng 11"); tên/cách liên hệ Hành chính lấy từ Cấu hình, không viết cứng; chữ phụ ≥ 14 px; nhãn trạng thái ≥ 12 px đậm 700.
- **Admin · ngăn điều chỉnh:** 3 nút review mở **hộp riêng** và áp dụng ngay (Chấp nhận: xác nhận ngắn; Thêm vào danh mục: form món có ĐVT + ảnh; Từ chối: ô lý do riêng); sau khi xử lý, khối đổi thành nhãn trạng thái. Ô "Lý do điều chỉnh" chỉ cho sửa số lượng/thêm/bớt. Dòng không giảm được dưới số đã giao: stepper khóa cận dưới + chú thích "đã giao 3".
- **Admin · Tổng hợp:** KPI "Phiếu đã đăng ký 32/40"; nút phụ "Sao chép danh sách chưa đăng ký"; bảng nhóm theo **phòng ban PMH ID** (hàng "Chưa có phòng ban" cuối); mockup ghi "Tổ Giám sát/Thiết kế" chỉ là ví dụ tên nhóm.
- **Admin · Giao hàng / Còn nợ:** mỗi đợt giao trong lịch sử có nút "Hoàn tác…" (hộp: số lượng, lý do); dòng còn nợ có nút "Hủy nợ…" (lý do).
- **Admin · Kho:** mỗi món có nút "Xuất lẻ…" (hộp: số lượng, người nhận từ danh bạ hoặc ô chọn "Dùng chung", lý do); sổ cái gắn nhãn xanh dương "Xuất lẻ · tên người".
- **Admin · Báo cáo:** cột "Đặt mua" là ô nhập (mặc định = Cần mua, nền vàng nhạt khi khác); bảng phụ "Xuất lẻ trong kỳ" dưới phần 1; nút "Xuất Excel" / "In trình ký" tạo **bản chốt**; nếu còn món ngoài danh mục chưa xem → hộp "Còn 3 món chưa xem — chốt vẫn thiếu các món này" (Quay lại / Vẫn chốt); danh sách bản chốt (giờ, người lập, tải lại / in lại).
- **Đăng nhập:** nút chính "Đăng nhập bằng tài khoản công ty (PMH ID)" ngay trên cùng, không cần email; dưới nút: "Bạn sẽ được đưa sang trang đăng nhập chung của công ty rồi quay lại đây."; ô email thu thành liên kết "Gợi ý tài khoản (tùy chọn)"; liên kết nhỏ cuối thẻ "Dành cho IT" mở ô tên tài khoản + mật khẩu (`type=text`).
- **Trang "Chưa được cấp quyền":** thẻ giữa, icon khóa, tiêu đề "Tài khoản chưa được cấp quyền dùng VPP Công trình", đoạn "Bạn đã đăng nhập PMH ID bằng {email}, nhưng tài khoản chưa thuộc nhóm được dùng ứng dụng này. Liên hệ {admin_contact} để được thêm vào nhóm.", nút chính "Đăng nhập bằng tài khoản khác", nút phụ "Về trang PMH ID".

