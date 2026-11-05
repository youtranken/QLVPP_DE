# Quyết định 2026-11-05 — Luồng Hành chính theo cách làm thật

> Trạng thái: **chủ dự án đã duyệt bản thiết kế v2 (2026-11-05)** — xem mục "Thiết kế v2". Câu hỏi còn mở ở cuối vẫn cần HC xác nhận khi dùng thử.
> Lý do: dự án bị lặp chỉnh giao diện vì quy trình Hành chính do chủ dự án + AI tự nghĩ, chưa ai xác nhận. Cảm giác "khó dùng" đến từ **luồng**, không phải màu/khoảng cách.

## Hành chính đang làm thật (đã gặp HC)

- Thu thập bằng **Google Form**, thống kê bằng **Google Sheet**.
- Hàng về → **nhân viên tự đến gặp HC lấy**; HC kiểm hàng, đưa, xong.
- HC hiện **không ghi kho**, không theo dõi còn nợ có hệ thống.

## Phạm vi (chốt)

App chỉ cho **phòng D&E**. Hai tầng Hành chính:

```
40 nhân viên D&E → HC phòng D&E (app VPP) → in phiếu D&E, Chủ quản đơn vị ký
  → gửi HC công ty (ADM) — ADM gộp mọi phòng ở sheet "Booking" (`VPPham (2).xlsx`) và mua
  → hàng ADM chia về D&E → nhân viên tự đến gặp HC D&E lấy
```

- ADM nằm **ngoài** app; với app, ADM đóng vai "nhà cung cấp".
- Mẫu phiếu phòng = sheet "ACC" trong `VPPham (2).xlsx`: STT · Mã (B01…) · Tên vật dụng · Item name · ĐVT · số lượng; ký "Chủ quản đơn vị" / "Người yêu cầu". App đã có mã món từ Booking và ô ký ở Cấu hình → bản in không phải chỗ gây lặp.
- Q6: **Xuất Excel gửi ADM phải đúng mẫu sheet phòng** (cùng cột, cùng mã) để ADM dán thẳng vào cột D&E của Booking — giá trị lớn nhất cho HC D&E.

## Quyết định

| # | Quyết định | Ghi chú |
|---|---|---|
| Q1 | Luồng chính theo cách HC thật: thu thập → tổng hợp/in → hàng về → nhân viên đến lấy | Mọi màn phục vụ luồng này trước |
| Q2 | Giữ đủ tính năng đã làm (kho, còn nợ, món ngoài danh mục…), nhưng **đường chính phải đơn giản**; ngoại lệ (thiếu, nợ, hết hàng) chỉ hiện khi xảy ra | Không xóa code, đổi cách trình bày |
| Q3 | **Hàng về** nhập **theo món**: danh sách món cần mua, ô số lượng **điền sẵn = Cần mua** (gồm nợ kỳ trước), HC sửa nếu thực về khác → kho cộng | Kho thành bước tự nhiên của luồng, không phải trang riêng HC phải nhớ |
| Q4 | **Giao** **theo người**: tìm tên người đang đứng trước mặt → "Giao đủ" một bấm; nếu tồn không đủ, ô số tự điền = tồn còn lại, HC sửa được (giữ cho người khác); phần thiếu **tự thành Còn nợ** | Hiện gợi ý "Còn n người chưa nhận món này, cần thêm x" để HC cân nhắc chia |
| Q5 | **Gộp Giao hàng + Còn nợ** thành một màn theo người: thấy cả phiếu tháng này lẫn nợ tháng trước ở đầu | Bớt một trang; HC không phải nhớ ai còn nợ |
| Q7 | **Món ngoài danh mục** hiếm (hiện ghi chú tay) → bỏ khỏi menu chính; chỉ hiện dòng nhắc "n món ngoài danh mục chờ xem" ở trang chủ khi có, bấm vào xử lý | Giữ chức năng, giấu khi không có |
| Q8 | **Menu Hành chính theo nhịp tháng**: `Tháng này` (trang chủ) · `Giao hàng` (tìm người, gồm nợ) · `Tủ / Kho` · `Cài đặt` (Danh mục, Nhóm, ĐVT, Danh bạ, Nhật ký, Cấu hình) | Thay ~12 mục chia theo loại dữ liệu |

### Q8 — Trang chủ "Tháng này" (phác)

```
① Đăng ký   32/40 người · còn 5 ngày   [Nhắc người chưa đăng ký]
② Gửi ADM   [In trình ký] [Xuất Excel mẫu phòng]
③ Hàng về   [Nhập hàng ADM chia về]   (điền sẵn = Cần mua)
④ Giao      28 người chưa nhận · 3 nợ  [Mở Giao hàng]
⚠ 1 món ngoài danh mục chờ xem        (chỉ hiện khi có)
```
Bước nào đang tới hạn thì nổi lên; bước xong thì thu gọn. Tổng hợp kỳ / Báo cáo & in hiện có trở thành màn chi tiết mở từ ① ②, không phải mục menu.

Xác nhận thực tế: D&E **có tủ riêng** cất hàng dư và **ADM hay chia thiếu** → Kho và Còn nợ là nhu cầu thật, giữ; chỉ đổi cách trình bày theo Q3–Q5.

Luật giữ nguyên: không âm kho (FR-41), `0 ≤ delivered_qty ≤ qty` (BR-8), Cần mua (BR-15), Hủy nợ có lý do (FR-35).

## Thiết kế v2 (chốt 2026-11-05)

Nguồn: canvas Claude Design https://claude.ai/artifact/KrkmryPgqfXKz79wjWo618 · bản sao file trong `design-preview/v2-glass/` (`*.dc.html`, mở bằng trình duyệt chỉ để đọc markup/dữ liệu mẫu; không phải code để copy nguyên).

| # | Quyết định | Ghi chú |
|---|---|---|
| Q9 | **Thay Q8 phần menu**: Hành chính có **sidebar** (theo ảnh mẫu `DE-VPP/exam admin dashboard.jpg`), 3 nhóm, nhãn viết thường: *Hằng tháng* (Tháng này · Giao hàng [badge số người chưa nhận] · Hàng về · Gửi ADM) · *Danh mục và tủ* (Danh mục món · Tủ / Kho [badge hết] · Món ngoài danh mục [badge chờ xem] · Nhóm và đơn vị tính) · *Quản lý* (Nhân viên · Nhật ký · Cấu hình). Đáy sidebar: khung tiến độ kỳ đang mở (x/40 đã đăng ký, giờ khóa) | `Sidebar.dc.html` |
| Q10 | **Giao diện**: nền gradient teal `#08303B → #0E4757 → #12596A`; sidebar kính `rgba(255,255,255,.05)`; panel nội dung mức **"Vừa"** `linear-gradient(180deg, #E3F1F5, #CBE4EB)` bo 28; thẻ trắng bo 20–22; nút chính mực `#0E2A33` dạng pill, nút phụ trắng viền `#C9DDE3`; cam `#B4540A`/nền `#FFF1E3` = thiếu/nợ; xanh `#11795A`/`#E3F5EE` = đã nhận; đỏ `#A32C1E`/`#FBE4E1` = hết; chữ `#0E2A33`, phụ `#47636C`; font **Be Vietnam Pro** | Thay token P3 "Navy & cát" |
| Q11 | **Tháng này**: dải tối lớn đầu trang = 4 bước của kỳ (Đăng ký → Gửi ADM → Hàng về → Giao), bước hiện tại có số lớn + thanh tiến độ + nút đi thẳng; chuyển kỳ (kỳ đang giao / kỳ đang đăng ký). Dưới: thẻ chính "n người chưa đăng ký" (tên + Chép tin nhắc Zalo); thẻ phụ mờ: món ngoài danh mục chờ xem (Từ chối/Chấp nhận tại chỗ), tủ sắp hết | `Main.dc.html` |
| Q12 | **Giao hàng**: lưới thẻ theo người (tab Chưa nhận / Còn nợ / Đã nhận / Tất cả có số, tìm tên/mã) — thẻ có avatar, nhãn trạng thái, **dải ảnh món trong phiếu**, dòng nợ kỳ trước, nút Xem / Giao đủ (hoặc "Giao x/y" khi thiếu). Panel phải: nợ kỳ trước ở đầu, từng dòng có ảnh + stepper (mặc định min(cần, tồn)), cảnh báo "Giao x, nợ y" + "Còn n người chờ món này", nút Giao → Người tiếp theo / Hoàn tác | `Giao.dc.html`; phiếu không có ảnh riêng — dùng ảnh món |
| Q13 | **Danh mục món**: lưới thẻ ảnh (tab Đang dùng / Sắp hết hoặc hết / Chưa có ảnh / Đã ngừng, chip nhóm, tìm). Thẻ chưa ảnh có nút **Tải ảnh lên**; **Sửa** mở panel phải: ô kéo thả ảnh (JPG/PNG/WebP ≤ 5 MB), Đổi/Xóa ảnh, tên, mã Booking (chỉ đọc), ĐVT, nhóm, tối đa/tháng, xem trước "Nhân viên sẽ thấy" | `DanhMuc.dc.html` |
| Q14 | **Hàng về** (bảng theo món, ô điền sẵn = còn chờ, nhãn Thiếu/Dư/Đủ, tủ sau khi lưu, ghi chú đợt), **Gửi ADM** (kiểm trước khi gửi, Số đề nghị = cần − tủ sửa được, xem trước A4 mẫu sheet phòng), **Tủ / Kho** (4 ô số, lọc, bảng có ảnh nhỏ) cùng khung Q9–Q10 | `HangVe`, `GuiADM`, `Kho.dc.html` |
| Q15 | **Nhân viên (máy tính)**: không sidebar; thanh trên có tab Đăng ký · Lịch sử · Tôi; đầu trang tiêu đề kỳ + số ngày còn + nhắc nợ cam. Lưới món full width **4–5 món/hàng** (ảnh, nhãn nhóm, badge số lượng cam, stepper/Thêm vào phiếu). Thanh lọc: tìm · sắp xếp (Hay dùng trước / Tên A→Z / Theo nhóm) · "Đã chọn (n)" · Chép lại tháng trước · chip nhóm có số · trạng thái rỗng "Xóa bộ lọc". **Phiếu bên phải nền cam nhạt `#FFF4E8` viền `#F7D9B5`**, dính khi cuộn, nút Lưu phiếu → hộp "Lưu phiếu tháng N?" (Quay lại sửa / Lưu phiếu). Lịch sử: mỗi tháng một thẻ, trạng thái từng dòng | `NhanVienPC.dc.html` |
| Q16 | **Nhân viên (điện thoại)**: đầu tối (chào, số ngày còn, nhắc nợ), panel "Vừa" bo trên, chip nhóm cuộn ngang, lưới 2 cột ảnh, thanh phiếu pill tối nổi + thanh dưới 3 mục | `NhanVien.dc.html` |

| Q17 | **Port**: 3 plan nối tiếp — **A** khung v2 (token, sidebar, shell) áp cho trang hiện có · **B** luồng HC mới (Tháng này, Giao theo người gộp nợ, Hàng về, Gửi ADM, Danh mục ảnh) · **C** trang Nhân viên máy tính + điện thoại. Nhánh mới tách từ `feat/giao-dien-hanh-chinh`. HC chủ yếu máy tính (< 768 px sidebar thành menu bật ra, không tối ưu sâu) | Mỗi plan xong app vẫn chạy |
| Q18 | Trang/chức năng **đã có (BE hoặc màn cũ) nhưng không nằm trong sidebar mới** (Tổng hợp kỳ, Báo cáo & in, Còn nợ riêng, …) **gom vào một nhóm sidebar riêng** cuối danh sách để chủ dự án xem lại sau; không xóa | Quyết định giữ/bỏ từng mục làm sau |
| Q19 | **Không có Hoàn tác** sau khi giao (bỏ nút trong `Giao.dc.html`). Giao sai → Tủ / Kho → Điều chỉnh có lý do | Backend không có hoàn giao; không cần thêm |

## Ví dụ chuẩn (dùng làm kịch bản kiểm)

Tháng 12: A cần 3 bút, B cần 10 bút → Cần mua 13.

1. Hàng về 10 → nhập 10 (điền sẵn 13, HC sửa thành 10). Kho = 10.
2. A đến → tìm A → Giao đủ 3. Kho = 7.
3. B đến → tìm B → ô điền sẵn 7, cảnh báo "Giao 7, còn nợ 3" → Giao. Kho = 0, B nợ 3.
4. Tháng sau: Hàng về điền sẵn gồm 3 nợ của B. B đến → đầu màn hiện "Nợ tháng 12: 3 bút" → Giao.

## Tạm hoãn

- `docs/plans/2026-11-02-mau1-nhan-vien.md` (41 task làm lại trang Nhân viên) — **hoãn** tới khi luồng Hành chính chốt và có người dùng thật thử.
- Mọi chỉnh UI thuần thị giác (px, độ mờ, chữ) — chỉ làm khi là bug hoặc người dùng thật phàn nàn.

## Câu hỏi còn mở (hỏi HC xác nhận)

- [ ] HC đồng ý nhập "Hàng về" theo món mỗi lần hàng về không?
- [ ] Hàng thiếu: HC muốn tự chia (sửa số) hay app gợi ý chia?
- [ ] Hết hàng / không mua được: HC báo nhân viên thế nào hiện nay? (→ Hủy nợ có lý do)
- [ ] (Sẽ hỏi tiếp) Tổng hợp/In, Món ngoài danh mục, trang Nhân viên.
