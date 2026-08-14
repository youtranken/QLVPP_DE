# ADR-0013 — Khung ngày đăng ký do admin cấu hình, cửa sổ phục vụ tháng sau

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-14
- **Thay thế:** phần "cửa sổ ngày 1–10" của [ADR-0009](./0009-mo-hinh-don-ky-va-cua-so-1-10.md)

## Bối cảnh

ADR-0009 chốt cửa sổ đăng ký **ngày 1–10**, cài dưới dạng **hằng số** trong
`packages/shared`. Nghiệp vụ đổi sang **ngày 20 đến hết tháng**, và lần đổi này cho
thấy vấn đề thật: mỗi lần công ty đổi lịch mua sắm lại phải **sửa code, build,
triển khai lại** — một quyết định hành chính bị buộc vào chu kỳ phát hành phần mềm.

Đổi con số cũng làm lộ ra một giả định ngầm trong `periodForDate`: quy tắc cũ là
"ngày > ngày-cuối-cửa-sổ thì tính sang tháng sau". Giữ nguyên quy tắc đó mà chỉ
thay số sẽ khiến đơn gửi ngày 25/8 rơi vào **kỳ tháng 8** — đăng ký cho tháng sắp
hết. Tức là cửa sổ ở **đầu tháng** và cửa sổ ở **cuối tháng** phục vụ hai kỳ khác
nhau, không suy ra được từ riêng con số ngày.

## Quyết định

- Khung ngày là **dữ liệu**, không phải hằng số: bảng `app_settings` **một dòng**
  (`CHECK (id)` + khoá chính) với `reg_window_start_day` / `reg_window_end_day`.
  Admin sửa ở màn **Cài đặt** (`/quan-tri/cai-dat`), ghi **audit** kèm giá trị cũ.
- Mọi hàm quy tắc **nhận khung ngày làm tham số** (`periodForDate`,
  `isRegistrationOpen`, `checkRegistrationWindow`, `canCancelRequest`). Không có giá
  trị mặc định ngầm ở chỗ gọi — trình biên dịch bắt mọi nơi phải nói rõ dùng khung nào.
- **Cửa sổ phục vụ tháng kế tiếp**: `ngày >= ngày-mở → kỳ tháng sau`, ngược lại là
  kỳ tháng hiện tại. Đây là quyết định **nghiệp vụ**, ghi thẳng vào hàm chứ không
  để người đọc tự suy từ con số.
- **Ngày cuối co theo tháng**: đặt ngày đóng là `31` nghĩa là "đến hết tháng"
  (tháng 2 → 28/29, tháng 4 → 30). Ngày **mở** cũng co, để admin lỡ đặt mở ngày 30
  thì tháng 2 vẫn có cửa sổ thay vì mất trắng một kỳ.
- Ràng buộc `1 ≤ mở ≤ đóng ≤ 31` được thực thi ở **cả CSDL và ứng dụng** — sửa tay
  bằng SQL là chuyện có thật khi xử lý sự cố.
- Frontend **không tự tính kỳ nữa**: `GET /api/registration/status` trả `period`,
  khung ngày và mô tả sẵn cho người đọc.

## Hệ quả

**Tích cực:** đổi lịch đăng ký là thao tác vận hành trong vài giây, không cần phát
hành; quy tắc kỳ được viết ra rõ ràng thay vì ẩn trong một phép so sánh; tháng
ngắn/dài và năm nhuận được xử lý một chỗ duy nhất; sai cấu hình bị chặn ở tầng CSDL.

**Tiêu cực:** thêm một lượt đọc CSDL trên các luồng cần khung ngày (chấp nhận: một
dòng, khoá chính, quy mô ≤500 người — ADR-0001); FE phải chờ `registration/status`
trước khi biết kỳ mặc định, nên vài màn quản trị có thêm trạng thái "đang tải";
admin đổi khung ngày có thể **lấy đi quyền gửi/huỷ đơn ngay lập tức** của nhân viên
— màn Cài đặt vì vậy hiện trước hậu quả và cảnh báo trước khi lưu.

## Phương án đã cân nhắc

- **Giữ hằng số, chỉ đổi số 1–10 thành 20–31:** ít việc nhất, nhưng lần đổi sau lại
  phải phát hành lại, và không giải quyết được chỗ `periodForDate` hiểu sai kỳ. → loại.
- **Đưa khung ngày vào biến môi trường:** không phải build lại, nhưng vẫn cần người
  có quyền vào máy chủ và **khởi động lại** api; người ra quyết định (hành chính)
  không tự làm được. → loại vì yêu cầu là **admin tự chỉnh trên web**.
- **Bảng khoá–giá trị (`key`/`value` jsonb) cho mọi cài đặt:** linh hoạt hơn cho
  tương lai, nhưng mất kiểu dữ liệu và không đặt được `CHECK` cho từng cài đặt.
  → chọn cột có kiểu rõ ràng; thêm cài đặt mới thì thêm cột.
- **Ngày đóng lưu riêng một cờ "đến hết tháng":** rõ nghĩa hơn nhưng thêm một
  trường và một nhánh xử lý; quy ước `31 = hết tháng` cho kết quả y hệt vì ngày cuối
  luôn được co theo tháng. → chọn quy ước, ghi rõ trên màn Cài đặt.

## Liên kết

`../product/PRD.md` FR-21/FR-23 · `../architecture/SDD.md` §5, §6 ·
`../operations/RUNBOOK.md` §4c · `packages/shared/src/period.ts` ·
`apps/api/src/modules/settings`.
