# PRD — Quản lý Văn phòng phẩm (VPP) phòng Công trình

> Phiên bản 1.1 (sau review 3 góc nhìn, xem `review-spec.md`) · 2026-10-28 · Chủ sở hữu: phòng Công trình (Hành chính) · Kỹ thuật: IT PMH
> Trạng thái: **chờ duyệt**. Tài liệu kỹ thuật đi kèm: `architecture.md`, `backlog/`. Mockup đã chốt: `design-preview/final/`.

## 1. Vấn đề và mục tiêu

Hiện nay phòng Công trình gom nhu cầu văn phòng phẩm bằng tay, dễ sót người, khó tổng hợp, không biết kho còn gì. Cần một web nội bộ để:

1. Nhân viên **tự đăng ký** món cần trong khung ngày 1–10 hằng tháng, trên máy tính hoặc điện thoại, không cần hướng dẫn.
2. Hành chính **tổng hợp một lần**, in trình ký, mua, giao và biết chính xác ai đã nhận gì, còn nợ gì.
3. Theo dõi **tồn kho đơn giản** để đề xuất mua đúng số lượng.
4. Đăng nhập bằng **PMH ID** (SSO), không quản lý tài khoản riêng.

Thành công sau 2 tháng vận hành: ≥ 90 % nhân viên phòng đăng ký đúng hạn qua app; Hành chính xuất được báo cáo trình ký trong < 5 phút; không còn bảng Excel tổng hợp tay.

## 2. Người dùng và vai trò

| Vai | Ai | Vào bằng | Làm gì |
|---|---|---|---|
| **Member** (nhân viên) | Toàn bộ nhân viên phòng Công trình (~40 người) | PMH ID cấp quyền vào VPP (theo Phòng/Nhóm, trừ danh sách loại trừ của ứng dụng) | Đăng ký món hằng tháng, xem lịch sử, nhận thông báo |
| **Admin** (Hành chính) | 1–3 người Hành chính của phòng | Quản trị viên dự án VPP trên PMH ID (`app_role = admin`) | Quản lý VPP: tổng hợp, điều chỉnh, duyệt món ngoài danh mục, giao, kho, danh mục, báo cáo, cấu hình; **không đăng ký VPP cho bản thân** (chốt 2026-10-30) |
| **SA** (quản trị kỹ thuật) | IT | Tài khoản cục bộ trong `.env` (không qua SSO) | Mọi quyền admin; dùng khi SSO lỗi hoặc cần can thiệp. Vô hình trong danh sách người dùng |

Quyền lấy từ claim `app_role` của PMH ID (token `ver: 3`); PMH ID tự gác cửa từng app ("ai được vào VPP") và cấp vai Quản trị viên dự án. App không còn gate theo group.

## 3. Phạm vi

### Giai đoạn 1 (MVP, dùng được ngay tháng đầu)
Đăng nhập SSO + SA · danh mục món có ảnh · phiếu đăng ký tháng (gồm món ngoài danh mục) · tổng hợp kỳ và điều chỉnh · duyệt món ngoài danh mục · giao hàng, giao thiếu, còn nợ · kho đơn giản · báo cáo tháng (in + Excel) · chuông thông báo trong app · nhật ký · cấu hình · đồng bộ danh bạ · triển khai sau EDGE.

### Giai đoạn 2
Email nhắc (ngày 1 và ngày 9) · phiếu giao nhận (mẫu do phòng cung cấp sau) · import danh mục từ Excel · thống kê theo quý/năm.

### Ngoài phạm vi
Duyệt theo cấp trưởng phòng · quản lý giá mua / ngân sách · đa phòng ban (thiết kế không chặn, nhưng không làm) · đặt hàng nhà cung cấp.

## 4. Thuật ngữ

| Từ | Nghĩa |
|---|---|
| **Kỳ** | Một tháng đăng ký, định danh `YYYY-MM`. |
| **Hạn đăng ký** | Hết 23:59:59 ngày 10 của tháng, giờ Việt Nam. |
| **Phiếu** | Danh sách món một người đăng ký cho một kỳ. Mỗi người một phiếu mỗi kỳ. |
| **Dòng** | Một món + số lượng trong phiếu. |
| **Món ngoài danh mục** | Dòng do người dùng tự ghi tên, chờ Hành chính xem. |
| **Giao thiếu / còn nợ** | Giao ít hơn số đăng ký; phần thiếu theo dõi riêng cho tới khi giao đủ. |
| **Tồn** | Số lượng hiện có trong kho của một món. |

## 5. Luồng một tháng (đã kiểm chứng với phòng)

Mô hình kỳ là **liên tục**: kỳ tháng M nhận đăng ký từ 00:00 ngày 11 tháng M−1 đến hết 23:59:59 ngày 10 tháng M. Nói cách khác, bất kỳ lúc nào cũng có đúng một kỳ đang mở; trang chủ nhân viên luôn là phiếu của kỳ đó.

- **Ngày 11 tháng trước → ngày 10** — Kỳ tháng 11 đang mở. Nhân viên vào thấy phiếu kỳ 11 (trống hoặc đã lưu), tên/phòng ban hiện sẵn, có thể "Chép lại danh sách tháng 10". Chọn món, bấm −/+, thêm món ngoài danh mục (tên + ĐVT + số lượng + ghi chú), **Lưu đăng ký** → hộp xác nhận → nhãn "Đã lưu 14:20 · sửa tiếp đến hết 10/11". Sửa bao nhiêu lần cũng được.
- **Ngày 1, 00:05** — Chuông: "Kỳ tháng 11 — hết hạn đăng ký 23:59 ngày 10/11".
- **Ngày 8, 00:05** — Chuông cho ai chưa có phiếu: "Bạn chưa đăng ký tháng 11 — hết hạn 23:59 ngày 10". Hành chính mở Tổng hợp, bấm "Sao chép danh sách chưa đăng ký" để nhắc qua Zalo.
- **Ngày 10, 23:59:59** — Hết hạn. Người bấm Lưu sau mốc này nhận thông báo kỳ 11 đã khóa; nội dung đang chọn được giữ lại trong giỏ của kỳ 12 (vừa mở).
- **Ngày 11** — Phiếu kỳ 11 khóa với nhân viên (hiện dạng thẻ "Tháng 11 đang giao" dưới phiếu kỳ 12). Chuông cho Hành chính: "Kỳ 11 đã khóa: 32/40 phiếu". Người quên → tháng sau, không ngoại lệ. Hành chính xem tổng hợp, xử lý từng món ngoài danh mục (chấp nhận / thêm vào danh mục / từ chối), điều chỉnh trường hợp đặc biệt (ghi lý do).
- **Ngày 12** — Hành chính mở Báo cáo: tổng theo món (Cần mua = nhu cầu chưa giao, kể cả nợ kỳ trước − tồn) và chi tiết theo phòng ban → người. Bấm Xuất Excel / In tạo **bản chốt** có giờ lập và người lập; nếu còn món ngoài danh mục chưa xem, hệ thống cảnh báo trước khi chốt. Bản chốt xem lại được bất cứ lúc nào.
- **Hàng về** — Nhập kho (+số lượng, ghi nguồn). Một cột nhập "Hàng về" (điền sẵn phần còn lại), "đã về n" ở chữ nhỏ dưới Đề nghị mua; chip = trạng thái đã lưu ("Nhận đủ hàng", "Thiếu n", "Dư n"); gõ thiếu hiện chữ đỏ "Nhập n · NCC còn nợ m", gõ dư hiện "Dư n" ngay; cột "Còn thiếu" chỉ hiện khi có dòng nhập thiếu; một nút "Lưu hàng về", không có "Đủ hàng"/"Đặt lại"/"Hoàn tác".
- **Giao** — Theo từng người: tick dòng hoặc "Giao tất cả"; thiếu thì nhập số thực giao → dòng vào **Còn nợ**. Kho trừ đúng số đã giao. Giao nhầm thì Hành chính tự đưa bù ngoài hệ thống (không có Hoàn tác trong GĐ1, FR-44). Chuông cho người nhận: "Phiếu tháng 11 đã giao đủ".
- **Về sau** — Màn Còn nợ liệt kê mọi dòng chưa đủ (xuyên kỳ); giao bổ sung tới khi hết.

## 6. Yêu cầu chức năng

### 6.1 Đăng nhập và phiên
- FR-01 Đăng nhập qua PMH ID (OIDC, PKCE) bằng một nút "Đăng nhập bằng tài khoản công ty (PMH ID)", không bắt gõ email (ô email tùy chọn để gợi ý tài khoản). Người PMH ID chưa cấp quyền vào VPP bị PMH ID từ chối → trang "Chưa được cấp quyền" nêu lý do, hướng dẫn liên hệ Hành chính (tên từ Cấu hình) và nút *Đăng nhập bằng tài khoản khác*. Đường vào SA là liên kết nhỏ "Dành cho IT".
- FR-02 Đăng nhập SA cục bộ bằng tên tài khoản + mật khẩu từ `.env`; khóa 15 phút sau 5 lần sai cùng cặp (IP, tên tài khoản) và 50 lần sai toàn hệ thống; phiên SA hết sau 2 giờ không hoạt động.
- FR-03 Đăng xuất thoát trình duyệt này khỏi Tài khoản D&E và mọi app (máy khác giữ phiên; "Đăng xuất mọi thiết bị" chỉ ở portal — chủ dự án chốt 15/11/2026). Phiên bị PMH ID thu hồi (khóa user, hết idle) → app tự đăng xuất; nếu phiên SSO còn sống, vào lại không cần gõ mật khẩu.
- FR-04 Hồ sơ hiển thị tên, email, mã NV, phòng ban từ PMH ID; không sửa được trong app.

### 6.2 Danh mục món (Admin)
- FR-10 Tạo/sửa món: tên (vi, en tùy chọn), **ĐVT chọn từ danh sách chuẩn** (cái, hộp, cây, ram, cuộn, lốc, bịch, chai, bộ) + quy cách tùy chọn ("hộp 12 cây", hiện cạnh tên ở mọi màn), nhóm, **ảnh bắt buộc**, `admin_only`, `max_qty` (mặc định 20), thứ tự.
- FR-11 Ngừng món (`active=false`): ẩn khỏi màn đăng ký, giữ nguyên trong phiếu cũ với nhãn "đã ngừng". Không xóa món đã từng có trong phiếu.
- FR-12 Quản lý nhóm món (tên, thứ tự, bật/tắt).
- FR-13 Món seed thiếu ảnh hiện placeholder + nhãn "thiếu ảnh" trong trang Danh mục.

### 6.3 Phiếu đăng ký (Member)
- FR-20 Trang chủ = phiếu của **kỳ đang mở** (xem §5); phiếu chỉ tồn tại khi đã lưu ≥ 1 dòng. Dải kỳ hiện `days_left` = số ngày lịch còn lại tính cả hôm nay ("Còn 5 ngày", ngày 10 là "Hôm nay là ngày cuối"). Danh mục dạng thẻ ảnh có nút −/+, lọc theo nhóm và tìm tên, giỏ bên phải; món tạm ngưng (ngừng riêng hoặc theo nhóm) vẫn hiện trên lưới với con dấu "Tạm ngưng" và không đặt được, món `admin_only` vẫn ẩn; phiếu đã lưu mở ở chế độ xem, bấm "Sửa phiếu" mới đổi số lượng; nút "Thêm món khác" đặt cạnh ô tìm và là thẻ cuối lưới. Nếu phiếu kỳ trước đang giao, hiện thẻ "Tháng M đang giao · 2/4 món" dẫn tới Lịch sử.
- FR-21 Giới hạn số lượng mỗi món theo `max_qty` ("tối đa 20/tháng"); món `admin_only` không hiện trong lưới của member; dòng `admin_only` do Hành chính thêm vào phiếu hiện **chỉ đọc** trong giỏ với nhãn "Hành chính thêm" và không bị mất khi member lưu lại.
- FR-22 Thêm món ngoài danh mục: tên (bắt buộc), **ĐVT (bắt buộc, chọn từ danh sách)**, ghi chú, **nhân viên không tải ảnh** (chốt 2026-10-30; server vẫn nhận ảnh tùy chọn ≤ 5 MB, Hành chính tải ảnh khi chuyển thành món mới), số lượng ≤ `default_max_qty`. Dòng sửa/xóa được trong giỏ trước khi lưu.
- FR-23 **Lưu đăng ký** → hộp xác nhận liệt kê món ("Quay lại sửa" / "Lưu phiếu") → lưu. Sau lưu: toast "Đã lưu phiếu tháng N" và nhãn trên hero "Đã lưu 14:20 · sửa tiếp đến hết 10/11". Khi có thay đổi chưa lưu: nút đổi thành "2 thay đổi chưa lưu · Lưu"; rời trang có cảnh báo. Lưu danh sách rỗng = xóa phiếu (nếu không dòng nào đã giao/đã duyệt). Nếu phiếu vừa bị Hành chính sửa ở nơi khác → báo "Phiếu vừa được Hành chính cập nhật, tải lại" (không ghi đè âm thầm).
- FR-24 "Chép lại danh sách tháng X" (X = kỳ gần nhất có phiếu, hiện đúng tên tháng): chép vào giỏ (chưa lưu); nếu giỏ đang có dòng → hỏi "Thay giỏ hiện tại?". Bỏ: món đã ngừng, món nay `admin_only`, dòng ngoài danh mục bị từ chối; dòng ngoài danh mục đã chấp nhận/đã thêm danh mục chép thành dòng mới (`pending` / món tương ứng); số lượng vượt `max_qty` mới bị hạ xuống `max_qty`. Báo từng dòng bị bỏ kèm lý do.
- FR-25 Sau hạn: phiếu chỉ đọc, hiện tiến độ giao từng dòng (đã giao / còn nợ), trạng thái món ngoài danh mục (chờ xem / chấp nhận / đã thêm danh mục / từ chối + lý do).
- FR-25a (vòng 3) Trang Đăng ký dùng hết bề ngang. Phiếu kỳ trước đang giao chỉ còn **một dải** "Phiếu tháng N đang giao · đã nhận d/t món, còn chờ k" + nút Xem mở popup nhận hàng (bảng Món · ĐVT · Đăng ký · Được giao · Đã nhận · Tình trạng; món Hành chính bỏ hiện "Không giao" + "HC bỏ món: lý do"); các tháng cũ hơn còn chờ là liên kết trong cùng dải. Không còn hai băng "Bạn còn chờ nhận" và thẻ kỳ trước.
- FR-26 Lịch sử (vòng 3): master–detail — cột trái nhóm theo năm, mỗi năm các tháng **có phiếu** (tháng không có phiếu bị ẩn, không có dòng "Không đăng ký"), cột phải là phiếu của tháng chọn (mặc định tháng mới nhất đã khóa): bảng Món · ĐVT · Đăng ký · Được giao · Đã nhận · Tình trạng · Ghi chú (giờ nhận, "HC bỏ món · lý do") và khối "Điều chỉnh của Hành chính". Điện thoại: danh sách rồi chi tiết (≤ 2 chạm), quay lại giữ danh sách.
- FR-27 Member chỉ thấy phiếu của mình.
- FR-28 Điện thoại (≤ 900 px): thanh điều hướng dưới 3 mục (Đăng ký · Lịch sử · Tôi); Lịch sử và Hồ sơ cách tối đa 2 chạm; thanh dính "N món · Lưu đăng ký".

### 6.4 Tổng hợp và điều chỉnh (Admin)
- FR-30 Kỳ tháng (thay Tháng này và Tổng hợp kỳ, vòng 3): một trang `/admin/month` với dải 4 bước gọn (Đăng ký x/y · Gửi ADM giờ gửi · Hàng về d/t món · Giao d/t phiếu, mỗi ô là liên kết sang trang bước), chuyển giữa kỳ đang giao, kỳ đang đăng ký và các tháng trước; y = số user `active` thuộc group được cấp, **trừ người thuộc group Hành chính**, **cộng chủ phiếu của kỳ không thuộc tập đó** (mỗi người đếm một lần, nên x ≤ y), tại lúc kỳ khóa (kỳ đang mở: tại thời điểm xem); bảng theo người (nhóm theo **phòng ban** đã chụp trên phiếu, lấy từ PMH ID — BR-11; cột Người · Nhóm · Số món · Tổng · Giao · Ghi chú · Lưu lúc), chip "Tất cả · Có ghi chú · Chưa giao xong", tìm theo tên, email hoặc phòng; "Xem" mở phiếu một người, "Điều chỉnh" mở ngăn điều chỉnh. Không còn nút chép danh sách chưa đăng ký (nhắc người chưa đăng ký chỉ còn chuông tự động và chip Chưa đăng ký ở Danh bạ), không còn tổng hợp theo món (xem ai đăng ký món ở Báo cáo & gửi ADM). Kỳ đang mở chỉ xem: danh sách người đã đăng ký và phiếu từng người, không có thao tác ghi.
- FR-31 Điều chỉnh phiếu đã có (kể cả sau hạn): sửa số lượng, thêm/bớt dòng, thêm món `admin_only`; **lý do bắt buộc khi kỳ đã khóa**, chỉ hai lựa chọn "Không có hàng" (lưu mã `adm_out_of_stock`) hoặc "Khác" (bắt buộc ghi ít nhất 3 chữ); dòng vượt tối đa chọn sẵn "Khác" với ghi chú "Vượt tối đa n" (sửa được); "Người đã nghỉ" chỉ hiện khi chủ phiếu đã nghỉ hoặc mở từ lọc người đã nghỉ (giữ việc không gửi chuông); mã cũ (`over_quota`, `duplicate`, `user_left`) vẫn đọc đúng nhãn trong lịch sử; không giảm số lượng xuống dưới số đã giao (`QTY_BELOW_DELIVERED`); không bớt dòng đã giao một phần; ghi nhật ký giá trị cũ/mới. Admin sửa phiếu của chính mình được phép, nhật ký đánh dấu `self`.
- FR-32 Hành chính không tạo phiếu thay nhân viên (gỡ 2026-11-06, Đ9). Quên đăng ký: chờ tháng sau; cần gấp: Xuất lẻ từ tủ nếu còn hàng.
- FR-33 Xử lý món ngoài danh mục — ba nút mở hộp riêng, **áp dụng ngay**, không phụ thuộc nút "Lưu điều chỉnh": **Chấp nhận** (giao như món thường, không tính tồn) / **Thêm vào danh mục** (tạo món mới có ảnh và ĐVT, cảnh báo nếu ĐVT khác dòng gốc, gắn dòng vào món, tồn ban đầu 0) / **Từ chối** (hộp có ô lý do riêng, bắt buộc; người đăng ký thấy). Dòng chép lại từ dòng đã chấp nhận kỳ trước có gợi ý "Đã chấp nhận kỳ trước → nên Thêm vào danh mục".
- FR-34 Nhãn "Người đã nghỉ" trên phiếu của user bị PMH ID khóa/xóa; admin bỏ dòng chưa giao hoặc giữ.
- FR-35 **Hủy nợ** (người đăng ký nhận chuông kèm lý do, trừ "Đã nghỉ việc"; email ở GĐ2): chỉ cho **nợ tháng trước** (dòng của các kỳ trước tháng đang giao); phần chưa nhận của tháng đang giao không Hủy nợ được (`NOT_DEBT_YET`) mà giảm ở Tổng hợp. Hành chính chọn một lý do có sẵn — ADM hết hàng · Người nhận không cần nữa · Đã nghỉ việc · Khác (Khác bắt buộc ghi chú ≥ 3 ký tự; ghi chú ≤ 200) — qua menu ⋯ của dòng Còn nợ; dòng rời Còn nợ, ghi nhật ký, số đăng ký gốc vẫn hiện trong lịch sử với nhãn "đã hủy n".

  Ghi chú — một đường cho "ADM không có / giao thiếu":

  | Lúc | Tình huống | Đường duy nhất |
  |---|---|---|
  | Sau khóa, trước/sau gửi ADM | HC thấy một người xin quá/không hợp lý | Giảm ở Tổng hợp, lý do theo dòng |
  | Sau gửi ADM, ADM báo **không có** món X cả kỳ | Mọi người chờ X | Đánh "ADM hết hàng" ở Hàng về → giao từ tủ theo đăng ký trước, hủy phần thiếu → ai chưa đến: tự hủy lúc khóa kỳ sau |
  | ADM giao thiếu, hứa giao bù | Người chờ phần thiếu | Không đặt lại; hàng bù nhập ở "Về bù kỳ trước"; ADM thôi giao → "ADM không giao nữa" |
  | Người nghỉ còn phần chờ | — | Không vào đề nghị; Kỳ tháng nhắc; giảm "Người đã nghỉ" / Hủy nợ "Đã nghỉ việc" |
  | Hàng về **thiếu** | ADM giao ít hơn bản in | Nhập số thật; giao chia theo đăng ký trước; phần thiếu ở **Chưa nhận**, thành nợ khi kỳ sau khóa |
  | Chưa nhận tháng đang giao, không giao nữa | — | Giảm ở Tổng hợp với lý do; **không** Hủy nợ |
  | Nợ tháng trước, không mua nữa | Còn nợ | Hủy nợ qua ⋯ với lý do có sẵn |
  | Dòng ngoài DM đã chấp nhận, ADM không mua được | — | Giảm về 0, lý do "ADM không còn hàng" (mọi trạng thái duyệt) |

### 6.5 Giao hàng và còn nợ (Admin)
- FR-40 Giao theo phiếu: tick từng dòng (mặc định giao đủ, sửa được số thực giao) hoặc "Giao tất cả" (giao những dòng kho đủ, báo danh sách dòng không giao được). Bấm đúp / hai admin cùng giao một dòng không giao hai lần. Giao hàng là bảng (không còn thẻ, không banner "n món chưa đủ tủ" — dòng thiếu tủ có chip "Tủ thiếu n món"). **Giao nhiều phiếu** (`POST admin/deliveries/bulk`): tick nhiều người rồi "Giao n phiếu" (chỉ dòng giao được; dòng ADM hết hàng giao từng người); mỗi phiếu giao độc lập, tủ thiếu thì giao phần có (phiếu đăng ký trước được trước), phần thiếu ở lại chờ hàng về / thành Còn nợ, không tự hủy.
- FR-41 Giao trừ tồn kho cùng lúc; nếu tồn không đủ → từ chối với số tồn hiện có; không bao giờ âm kho. Món ngoài danh mục đã chấp nhận giao không trừ tồn. Dòng bị từ chối / chờ xem không giao được.
- FR-42 Màn **Còn nợ**: mọi dòng chưa đủ (`delivered_qty < qty`, không tính dòng từ chối/chờ xem/đã hủy nợ) của các kỳ **trước tháng đang giao**, nhóm theo món và theo người; nút giao bổ sung; Hủy nợ trong menu ⋯; lịch sử từng đợt giao của một dòng. Màn Còn nợ nhóm theo **tháng → người → món** (đăng ký, đã giao, còn nợ, tủ còn), đầu trang một hàng: chọn tháng, tìm, "Chỉ người đã nghỉ"; không thẻ số liệu.
- FR-43 Chuông cho người nhận khi phiếu giao đủ (một lần khi phiếu giao đủ).
- FR-44 ~~Hoàn tác đợt giao~~ — **bỏ khỏi GĐ1** (chủ dự án 2026-10-28: ghi giao nhầm thì Hành chính tự đưa bù ngoài hệ thống).

### 6.6 Kho (Admin)
- FR-50 Tồn hiện tại từng món. **Sắp hết** khi đã dùng hết 80 % lượng tồn tính từ lần nhập mua gần nhất: mốc = ⌊20 % × tồn ngay sau lần nhập đó⌋ (hoặc lần điều chỉnh tồn đầu kỳ khi món chưa có mốc), sắp hết khi `0 < tồn ≤ mốc`; tồn = 0 là **Hết hàng** (kể cả món chưa có mốc). Món chưa từng nhập mua mà còn tồn không cảnh báo. Mỗi lần nhập mua tính lại mốc (ví dụ tồn 0 → nhập 30: mốc 6; còn 6 thì sắp hết; nhập thêm 20 lúc còn 6 → tồn 26, mốc 5). Không còn ô "mức tồn tối thiểu" nhập tay.
- FR-51 Nhập mua: +số lượng, ghi chú (đơn hàng/nguồn).
- FR-52 Điều chỉnh kiểm kê: ±số lượng, lý do bắt buộc (dùng cho tồn đầu kỳ).
- FR-53 Sổ cái: mọi biến động (nhập, giao, xuất lẻ, điều chỉnh) với người thực hiện, lý do và thời điểm; xem theo món.
- FR-54 **Xuất lẻ** (ngoài phiếu): admin xuất kho cho một người (chọn từ danh bạ — ví dụ người mới vào giữa kỳ) hoặc "Dùng chung" (A4, mực in…), lý do bắt buộc; trừ tồn như giao hàng, không tạo phiếu, không ảnh hưởng hạn đăng ký; nếu tồn không đủ → từ chối, người đó chờ kỳ sau. Người nhận thấy mục "Nhận lẻ" trong Lịch sử. Thực tế: Hành chính chủ động mua dư để có tồn cho các trường hợp này.

### 6.7 Báo cáo (Admin)
- FR-60 Báo cáo tháng gồm **2 phần**: (1) Tổng theo món: Món · ĐVT · Chưa giao kỳ này (phần đăng ký kỳ này chưa giao/hủy — số giao rồi không cần mua) · Nợ kỳ trước · Tồn · **Cần mua** (tính theo BR-15) · **Đặt mua** (mặc định = Cần mua, admin sửa được trước khi chốt để mua dư dự phòng; lưu vào bản chốt); nhóm "Ngoài danh mục" (dòng đã chấp nhận) có Cần mua = tổng; (2) Chi tiết: Phòng ban → Người → Món · SL (số đăng ký sau điều chỉnh). Xuất lẻ trong kỳ hiện ở bảng phụ "Xuất lẻ trong kỳ" (món, người nhận/dùng chung, SL, lý do). **Vòng 3:** Gửi ADM và Báo cáo là một màn "Báo cáo & gửi ADM" (`/admin/reports`): một hàng đầu trang (chọn tháng, công tắc "Chỉ món có Tổng cần", Xuất Excel, In trình ký), đúng một dòng trạng thái (Đã gửi ADM giờ gửi, có n món đổi sau bản này, In lại, món ngoài danh mục chờ duyệt), bảng kẻ ô Món · ĐVT · Đăng ký · Nợ tháng trước · Tủ hiện có · Tổng cần · Đề nghị · Ai đăng ký, nhóm theo danh mục; kỳ khóa gần nhất sửa Đề nghị ngay trong bảng (khởi tạo từ bản đã gửi, không còn bước "Lập bản mới"), kỳ cũ hơn chỉ đọc số của bản đã gửi; "n người" mở popup Ai đăng ký món (số từng người, việc HC đã bỏ, Xem phiếu). Không còn Phần 2 theo phòng ban trên màn hình (vẫn có trong phụ lục bản in), mục Xuất lẻ trong kỳ (vẫn ở Tủ / Kho › Xuất lẻ), Xem trước phiếu. Các bản chốt hiện ở hộp gập "Các bản đã in / xuất (n)".
- FR-61 Xuất Excel 2 sheet (ngôn ngữ theo `?lang`); **In** từ trình duyệt với bố cục in riêng, chân trang 3 ô ký *Người lập · Trưởng phòng · Duyệt* in sẵn tên từ Cấu hình.
- FR-62 Xem trên màn hình = số liệu sống. Bấm Xuất/In tạo **bản chốt** (số liệu, giờ lập, người lập) lưu lại; danh sách bản chốt của kỳ xem lại và tải lại được. Nếu còn dòng ngoài danh mục `pending` → hộp cảnh báo "Còn n món chưa xem; chốt vẫn thiếu các món này" với lựa chọn tiếp tục hoặc quay lại.

### 6.8 Thông báo
- FR-70 Chuông trong app, đánh dấu đã đọc; mỗi sự kiện một thông báo cho mỗi người (không trùng); sự kiện: ngày 1 "kỳ M — hết hạn 23:59 ngày 10" (mọi người) · ngày 8 "chưa đăng ký" (chỉ người chưa có phiếu) · phiếu đã giao đủ · món ngoài danh mục được chấp nhận / thêm danh mục / từ chối · (admin) ngày 11 "kỳ đã khóa x/y" · có món ngoài danh mục mới · món dưới mức tối thiểu (một lần cho tới khi nhập thêm). Thông báo giữ 90 ngày.
- FR-71 (GĐ2) Email nhắc ngày 1 và ngày 9 qua SMTP.

### 6.9 Quản trị
- FR-80 Danh bạ: đồng bộ từ PMH ID (tự động mỗi 60 phút + nút "Đồng bộ ngay"); hiện người PMH ID cho vào VPP, trạng thái (đang dùng / đã khóa / không còn quyền), Phòng và Nhóm (từ PMH ID); người mất quyền vào VPP được đánh dấu "Không còn quyền" (không xóa lịch sử).
- FR-81 Nhật ký: mọi thao tác admin và sự kiện xác thực, lọc theo người/hành động/ngày/`self`, chỉ đọc, phân trang.
- FR-82 Cấu hình: ngày hạn đăng ký (3–28, mặc định 10; **chỉ áp dụng cho kỳ tạo sau**, UI ghi rõ "kỳ đang mở giữ hạn cũ"), số lượng tối đa mặc định (20), khối "Quyền truy cập" chỉ đọc (liệt kê Hành chính hiện tại, do PMH ID cấp), tên 3 người ký báo cáo, tên/cách liên hệ Hành chính (hiện ở trang member và trang từ chối).
- FR-83 Nhóm người theo **phòng ban lấy từ PMH ID** (claim `department`, đồng bộ qua Directory API); app không có trường "tổ" riêng, chỉ có cột `users.team` (nullable) điền từ claim `team` nếu PMH ID gửi, dùng cho cột Nhóm ở Tổng hợp kỳ mở; không chụp lên phiếu. Tổng hợp, báo cáo, danh sách nhắc đều nhóm theo phòng ban đã chụp trên phiếu (BR-11); thiếu phòng ban → nhóm "Chưa có phòng ban". Nếu thực tế phòng ban quá thô, cân nhắc thêm "Tổ" ở GĐ2.

### 6.10 Song ngữ
- FR-90 Giao diện tiếng Việt mặc định, chuyển sang tiếng Anh; tên món có bản dịch tùy chọn.

## 7. Luật nghiệp vụ (server là nơi quyết định)

| Mã | Luật |
|---|---|
| BR-1 | Kỳ đang mở = tháng hiện tại nếu `ngày ≤ hạn`, ngược lại tháng kế; tính theo `Asia/Ho_Chi_Minh` bằng đồng hồ server. Luôn có đúng một kỳ đang mở. |
| BR-2 | Hạn của kỳ = hết 23:59:59 ngày `registration_last_day` của tháng đó, **chụp vào kỳ lúc kỳ được tạo**; đổi cấu hình không đổi hạn kỳ đã tồn tại. Không gia hạn, không ngoại lệ. |
| BR-3 | Một người một phiếu mỗi kỳ. |
| BR-4 | Member chỉ sửa phiếu của mình và chỉ khi kỳ còn mở. |
| BR-5 | `1 ≤ qty ≤ max_qty` của món (dòng ngoài danh mục: `default_max_qty`) khi thêm hoặc tăng; dòng đã lưu được giảm dù `max_qty` sau đó bị hạ; member không chạm món `admin_only` hay món đã ngừng (dòng đã lưu của món đó chỉ giữ nguyên hoặc bỏ), Hành chính được giảm; dòng `admin_only`/`converted`/đã giao trong phiếu được giữ nguyên khi member lưu. |
| BR-6 | Admin sửa phiếu đã có mọi lúc; sau hạn phải có lý do; mọi thay đổi (sửa, thêm, bớt dòng, đổi phòng ban) ghi nhật ký cũ/mới. |
| BR-7 | Không tạo phiếu mới cho một kỳ đã khóa. |
| BR-8 | `0 ≤ delivered_qty ≤ qty`; mỗi đợt giao là một biến động kho âm; tồn không âm; không giảm `qty` dưới `delivered_qty`. |
| BR-9 | Món ngoài danh mục phải được xử lý (chấp nhận/thêm/từ chối) trước khi giao; dòng từ chối không vào Còn nợ, không vào báo cáo. Thêm vào danh mục thành món **mới** mà dòng không có ảnh: Hành chính phải tải ảnh món (`IMAGE_REQUIRED`). |
| BR-10 | Ảnh bắt buộc khi tạo món mới qua giao diện (`IMAGE_REQUIRED`); dòng món ngoài danh mục không cần ảnh (chốt 2026-10-30). |
| BR-11 | Phòng ban trên phiếu = phòng ban PMH ID của người đó tại lần lưu cuối (của member hoặc admin); tổng hợp và báo cáo cùng dùng giá trị này. |
| BR-12 | Phiếu tồn tại khi và chỉ khi có ≥ 1 dòng đã lưu; mở trang không tạo phiếu. |
| BR-13 | Giao hàng và review là thao tác **một lần**: lặp lại cùng yêu cầu không tạo thêm hiệu ứng (idempotent theo `expected_delivered_qty` / `LINE_ALREADY_REVIEWED`). |
| BR-14 | Ảnh chỉ đọc được bởi admin, người tải lên, hoặc mọi người đã đăng nhập nếu là ảnh của món trong danh mục. |
| BR-15 | `Cần mua(món, kỳ K) = max(0, Σ(qty − delivered_qty) của mọi dòng chưa đủ, chưa hủy, đã duyệt, thuộc kỳ ≤ K − tồn hiện tại)`; nhóm Ngoài danh mục không trừ tồn. |

## 8. Màn hình (theo mockup `design-preview/final/`)

**Member (thanh trên; điện thoại: thanh dưới 3 mục):** Đăng ký tháng này · Lịch sử · Chuông · Tôi (hồ sơ, ngôn ngữ, đăng xuất).
**Admin (sidebar):** Kỳ tháng · Báo cáo & gửi ADM · Hàng về · Giao hàng · Còn nợ · Sản phẩm · Tủ / Kho · Món ngoài danh mục · Danh mục · Danh bạ · Nhật ký · Cấu hình. Hành chính đăng nhập vào thẳng Kỳ tháng; không có *Phiếu của tôi*.
**Đăng nhập:** nút "Đăng nhập bằng tài khoản công ty (PMH ID)"; liên kết nhỏ "Dành cho IT" → SA cục bộ. **Chưa được cấp quyền:** trang riêng (tiêu đề, lý do, liên hệ Hành chính, nút đổi tài khoản).
Mockup hiện tại (`final/*.html`) chưa phản ánh các thay đổi sau review (thanh dưới, nhãn đã lưu, vị trí nút thêm món, hộp review riêng, trang từ chối); `_SPEC.md` mục "Thay đổi sau review" là nguồn đúng khi làm FE.

Hệ thị giác: member kiểu app (Nunito, bo tròn, thẻ ảnh, thương hiệu xanh ngọc lục `#059669`; chi tiết `design-preview/_SPEC.md`); Hành chính theo M1/P3 "Navy & cát" (Be Vietnam Pro, sidebar sáng 3 nhóm, bảng nhóm dính, ngăn kéo; chi tiết `docs/specs/2026-10-30-giao-dien-moi-hanh-chinh.md`).

## 9. Yêu cầu phi chức năng

- **Dùng được trên điện thoại** cho toàn bộ luồng member (chụp ảnh món ngoài danh mục ngay từ máy).
- **Hiệu năng:** 40 người đồng thời ngày 10 không cảm nhận chậm; trang đăng ký tải < 2 s trên mạng nội bộ.
- **Toàn vẹn:** mọi luật ở mục 7 được ép ở server và, nơi có thể, ở ràng buộc CSDL.
- **Bảo mật:** theo chuẩn QLTS (cookie httpOnly/Strict, CSRF, giới hạn tần suất, verify JWT offline, HMAC webhook); ảnh tải lên được kiểm định dạng thật, tên file ngẫu nhiên, chỉ phục vụ qua API có phiên.
- **Kiểm toán:** nhật ký append-only, không sửa/xóa được kể cả bởi admin.
- **Sẵn sàng:** PMH ID sập thì người đang đăng nhập vẫn dùng; chỉ đăng nhập mới bị ảnh hưởng; SA cục bộ luôn vào được.
- **Sao lưu:** hằng đêm, mã hóa, giữ 30 ngày (theo QLTS).
- **Song ngữ** vi/en.

## 10. Tiêu chí nghiệm thu giai đoạn 1

1. Nhân viên được PMH ID cấp quyền vào VPP đăng nhập và lưu được phiếu có ảnh món ngoài danh mục từ điện thoại; người chưa được cấp thấy trang "Chưa được cấp quyền".
2. Với đồng hồ test đặt 23:59:59 ngày 10 lưu được vào kỳ 11; đặt 00:00:00 ngày 11: `GET /periods/current` trả `{ym: 2026-12-01, is_open: true}`, lưu rơi vào kỳ 12, phiếu kỳ 11 chỉ đọc; `days_left` ngày 6 = 5, ngày 10 = 1.
3. Admin sửa số lượng một phiếu sau hạn → bắt buộc lý do; nhật ký hiện giá trị cũ/mới. Admin thêm dòng `admin_only` trước hạn, member lưu lại → dòng vẫn còn. Giảm dưới số đã giao → `QTY_BELOW_DELIVERED`.
4. Admin chuyển một món ngoài danh mục thành món mới (có ảnh, ĐVT) → món xuất hiện trong lưới của mọi người ngay (kỳ đang mở); dòng gốc gắn vào món (giữ nguyên bản ghi, không gộp), tồn 0.
5. Giao 3/5 → dòng xuất hiện ở Còn nợ; bấm giao 2 hai lần liên tiếp → chỉ một lần có hiệu lực; giao thêm 2 → hết nợ; tồn kho trừ đúng 5; cố giao vượt tồn bị chặn.
6. Đăng ký 5, tồn 2, đã giao 2 → Cần mua = 1; nợ 2 kỳ trước + đăng ký 3 kỳ này, tồn 0 → Cần mua = 5. Xuất Excel 2 sheet và in trang có 3 ô ký (có tên) tạo bản chốt; mở lại bản chốt sau khi giao thêm vẫn ra số cũ.
7. Khóa user trên PMH ID → phiên app bị hủy trong ≤ 10 s (webhook v2 đúng chữ ký; chữ ký v1 hoặc `ts` lệch > 300 s bị 401); gỡ Quản trị viên dự án (webhook `role_changed`, hoặc tối đa ≤ 5′ qua refresh token) → request kế tiếp 403; thu hồi quyền vào VPP → request kế tiếp 401.
8. SA cục bộ đăng nhập được khi tắt kết nối tới PMH ID; 5 lần sai từ IP A với tên X không khóa IP B; `req.ip` qua 2 hop proxy là IP máy người dùng.
9. Danh sách màn hình trong §8 chuyển được vi ↔ en; lint không còn chuỗi cứng; axe không báo lỗi tương phản ở 390 px.
10. Playwright 390 px: member vào được Lịch sử và Tôi trong ≤ 2 chạm; thấy nút "Thêm món khác" không cần cuộn hết lưới; sau khi lưu thấy nhãn "Đã lưu hh:mm"; member A không tải được ảnh dòng ngoài danh mục của B (403) nhưng tải được ảnh món (200).

## 11. Nhật ký quyết định

| Ngày | Quyết định |
|---|---|
| 2026-10-28 | Tự xây, không dùng InvenTree/Snipe-IT/Odoo. |
| 2026-10-28 | Không có bước trưởng phòng duyệt. |
| 2026-10-28 | Tồn kho đơn giản (nhập, giao trừ, cảnh báo); không giá mua. |
| 2026-10-28 | 1 phiếu/người/tháng, sửa đến hết 23:59 ngày 10; không gia hạn, không ngoại lệ. |
| 2026-10-28 | Admin sửa phiếu đã có sau hạn; không tạo phiếu mới cho người quên. |
| 2026-10-28 | Giao thiếu được; theo dõi còn nợ riêng. |
| 2026-10-28 | Món ngoài danh mục: chấp nhận / thêm vào danh mục / từ chối; ảnh bắt buộc khi tạo món. |
| 2026-10-28 | Báo cáo 2 phần + 3 ô ký; Excel + In. |
| 2026-10-28 | Chuông in-app GĐ1, email GĐ2. Member chỉ thấy phiếu mình. |
| 2026-10-28 | Admin = group PMH ID `vpp_admin`; SA cục bộ từ `.env` như QLTS. (Thay bằng dòng 2026-11-08.) |
| 2026-11-08 | PMH ID claims v3: bỏ hẳn mô hình group; Hành chính = Quản trị viên dự án VPP (`app_role`), PMH ID tự gác cửa; người mất quyền → "Không còn quyền"; mẫu số = người `active` không phải Hành chính. |
| 2026-10-30 | Hành chính chỉ quản lý VPP, không đăng ký cho bản thân: `/`, `/history`, `/me` chuyển về `/admin`; `me/request*` và `me/issues` trả 403 `FORBIDDEN_ROLE`; mẫu số, danh sách chưa đăng ký và chuông kỳ loại Hành chính; tạo hộ cho Hành chính → `USER_IS_ADMIN`; phiếu cũ giữ nguyên. |
| 2026-10-28 | Giao diện: member kiểu app, admin kiểu quản lý, màu `#059669`; khác QLTS và PMH ID. |
| 2026-10-28 | Song ngữ vi/en từ đầu. |
| 2026-11-06 | Gỡ "Tạo phiếu hộ" (Đ9): Hành chính không tạo phiếu thay nhân viên; route tạo phiếu thay người không còn (404), bỏ cờ loại Hành chính khi tìm người, bỏ mã `REQUEST_EXISTS`, `USER_IS_ADMIN`; phiếu cũ do Hành chính tạo giữ nguyên. Hành chính chỉ làm việc trên kỳ đã khóa sổ (`PERIOD_NOT_LOCKED`). |
| 2026-10-28 | Plan 3: bỏ Hoàn tác đợt giao; Hủy nợ báo chuông (email GĐ2) kèm lý do; chỉ giao sau khi kỳ khóa; mỗi lần Xuất/In tạo một bản chốt mới. |
| 2026-10-28 | "Sắp hết" = đã dùng 80 % tồn sau lần nhập mua gần nhất (mốc tự tính 20 %); bỏ mức tối thiểu nhập tay. |
| 2026-10-28 | Có "Xuất lẻ" ngoài phiếu (người mới, dùng chung) từ tồn mua dư; cột "Đặt mua" sửa được trên báo cáo. |
| 2026-10-28 | Sau review 3 góc nhìn (`review-spec.md`): mô hình kỳ liên tục; phiếu tồn tại khi có dòng; hạn chụp vào kỳ; nhóm theo phòng ban PMH ID (không có trường Tổ); Cần mua gồm nợ kỳ trước trừ tồn + bản chốt báo cáo; hoàn tác đợt giao; hủy nợ; ĐVT chuẩn; member giữ dòng Hành chính thêm; thanh dưới trên điện thoại. |

### Góp ý Nhóm 1 (07/11)

Chủ dự án thử tay kỳ đang mở và chốt các thay đổi sau (thắng mọi nguồn cũ khi mâu thuẫn).

- Nhân viên thấy cả món tạm ngưng trên lưới Đăng ký, có con dấu "Tạm ngưng" chéo, không đặt được (FR-20). `GET /api/items` của nhân viên trả cả món `usable=false`; món `admin_only` vẫn chỉ trả khi được liệt kê trong `include_inactive_ids`. Luật server không đổi: thêm hoặc tăng dòng món ngừng vẫn bị `ITEM_INACTIVE`, giữ nguyên hoặc bỏ dòng vẫn được.
- Phiếu đã lưu mở ở chế độ xem; "Sửa phiếu" mới mở ô đổi số lượng. Dòng món tạm ngưng hoặc tối đa bị hạ dưới số đã đặt báo đỏ trong phiếu.
- Tên mục: "Danh mục món" thành "Sản phẩm", "Nhóm & đơn vị" thành "Danh mục". Một nhãn trạng thái duy nhất "Tạm ngưng", hành động ngược lại "Dùng lại".
- Hộp "Thêm món khác" chọn sẵn đơn vị "cái", đơn vị và số lượng cùng một hàng, bấm nền không đóng hộp.
- Hành chính xem được Tổng hợp của kỳ đang mở ở chế độ chỉ xem: dải thông báo, hai ô số, bảng người đã đăng ký (Người, Nhóm, Số món, Lưu lúc) và popup phiếu từng người với nút người trước/sau. Không điều chỉnh, không gỡ, không gửi ADM cho tới khi kỳ khóa (FR-30). Cột Nhóm là `users.team`, lấy từ claim `team` của PMH ID khi IdP gửi, trống hiển thị "—" (FR-83).
- Tài khoản nhân viên mở bằng hộp ở đầu trang (popover máy tính, sheet điện thoại); `/me` giữ làm liên kết cũ.
- Sản phẩm (Hành chính): tab mặc định "Tất cả"; món tạm ngưng nằm tại chỗ, thẻ lưới có con dấu đỏ chéo "Tạm ngưng" (không gạch tên), dòng bảng và dòng Danh mục gạch tên kèm nhãn đỏ. Nhóm tạm ngưng thu gọn thành một dòng, có "Dùng lại nhóm". Nút "Tạm ngưng" lặp theo thẻ, dòng, panel là nút trung tính, chỉ đỏ khi rê chuột hoặc focus bàn phím; bấm xong có thông báo kèm "Hoàn tác". Thanh thao tác hàng loạt sáng, cùng hàng với tab; tab "Tạm ngưng" chỉ có "Dùng lại" và "Chuyển nhóm". "Dùng lại" hàng loạt bỏ qua món chỉ tạm ngưng vì nhóm của nó (dòng báo "Bật lại nhóm để đổi từng món").
- Danh mục: bảng đủ bề ngang, nút "Sửa" và "Tạm ngưng" ngay trên dòng (không menu ⋯), bỏ khung xem trước. Panel Sửa sản phẩm chia khối "Thông tin" và "Đặt hàng"; chọn nhóm bằng ô chọn; "Tạm ngưng", "Xóa" ở chân panel.

Vòng 2 (thắng các ý trên khi mâu thuẫn):

- Phiếu nhân viên, tối đa bị hạ: câu "Hành chính đã đổi tối đa còn N/tháng. Số lượng Q vẫn được giữ, không thể tăng thêm.", Q là số lượng hiện tại của dòng, chỉ hiện khi Q còn vượt N.
- Thẻ món của nhân viên ghi giới hạn một cụm "Tối đa 1 ống/tháng"; món không giới hạn chỉ ghi đơn vị.
- Sửa phiếu chưa đổi gì: nút chính là "Hủy" (về chế độ xem), không để nút "Lưu phiếu" vô hiệu. Đã đổi: "Lưu phiếu" kèm "Hủy" bỏ mọi thay đổi về phiếu đã lưu.
- Dòng món tạm ngưng trong phiếu: "Sản phẩm này đã tạm ngưng và không thể đặt hàng."
- Sản phẩm: "Tạm ngưng" và "Dùng lại" từng món (thẻ, dòng bảng, panel Sửa sản phẩm) đều hỏi xác nhận kèm một câu hệ quả; xong chỉ báo thành công, bỏ "Hoàn tác". Công tắc món trong panel nhóm ở Danh mục giữ như cũ.
- Thanh lọc Sản phẩm: hàng 1 ô tìm + trạng thái (Tất cả / Đang dùng / Tạm ngưng / Chưa có ảnh, có số) + Lưới/Bảng, cùng cao 40px; hàng 2 chip nhóm nhỏ hơn, một dòng cuộn ngang, "Thu tất cả" ở cuối hàng; thanh hàng loạt là hàng riêng khi có chọn.
- Thao tác hàng loạt theo nội dung lựa chọn: có món ngừng riêng thì có "Dùng lại (n)", có món đang dùng thì có "Tạm ngưng (n)"; món của nhóm tạm ngưng vẫn phải bật lại nhóm.
- Tháng này: thẻ món ngoài danh mục ghi tháng của phiếu (món chờ xem chỉ thuộc kỳ đã khóa). Thẻ chưa đăng ký nói rõ cơ sở đếm "a/b người dùng app đã đăng ký" (người đang dùng, không phải Hành chính, không phải cả danh bạ); "Xem tất cả" mở đúng danh sách đó ở Tổng hợp kỳ đang mở.
- Lối vào kỳ đang mở: bước Đăng ký của kỳ đang mở có nút "Xem đăng ký kỳ tháng N"; các trang chỉ-kỳ-khóa không còn băng mời xem kỳ đang mở (chuyển kỳ ở trang Kỳ tháng); kỳ mở có hai danh sách "Đã đăng ký (n)" / "Chưa đăng ký (n)".

### Góp ý vòng 3 Nhóm 2–5 (08/11)

Chủ dự án duyệt mockup "Vòng 3"; các quyết định dưới đây thắng mọi nguồn cũ khi mâu thuẫn (bước thử tay ở `test-manual-nhom.md`).

- Quy tắc của chủ dự án: Hàng về một cột nhập, cột "Còn thiếu" chỉ hiện khi nhập thấp hơn số còn cần, không Hoàn tác; nút giao chỉ ghi "Giao n phiếu"; Kỳ tháng bỏ các chữ lẻ; "Còn nợ" là Hành chính còn nợ nhân viên (không phải ADM nợ Hành chính).
- D1: lý do điều chỉnh chỉ còn "Không có hàng" (mã `adm_out_of_stock`) và "Khác"; api, CHECK, dữ liệu cũ không đổi, mã cũ giữ nhãn cũ trong lịch sử.
- D2: dòng vượt tối đa chọn sẵn "Khác" + "Vượt tối đa n"; "Người đã nghỉ" chỉ cho chủ phiếu đã nghỉ (server từ chối `user_left` với người còn làm).
- D3: giao nhiều phiếu: `POST admin/deliveries/bulk`, mỗi phiếu một transaction, số từng dòng do web tính như hộp giao đơn, kết quả từng phiếu, idempotent qua `expected_delivered_qty`; tủ thiếu thì giao phần có, phần thiếu thành Còn nợ; không tự hủy phần ADM hết hàng.
- D4: Kỳ tháng bỏ thẻ Món ngoài danh mục chờ duyệt và Sắp hết (đã có huy hiệu ở menu); giữ nhắc người đã nghỉ.
- D5: Báo cáo & gửi ADM: Đề nghị luôn sửa được ở kỳ khóa gần nhất, khởi tạo từ bản đã gửi; In/Xuất tạo bản mới; bỏ "Lập bản mới", "Xem trước phiếu" và Xuất lẻ (còn ở Tủ / Kho).
- D6: "Không Hoàn tác" chỉ áp cho bảng Hàng về đợt này; Hoàn tác của "ADM không giao nữa" giữ nguyên.
- D7: dải nhận hàng của nhân viên theo phiếu kỳ đang giao; kỳ cũ còn chờ là link ngắn trong cùng dải.
- D8: bỏ Tổng hợp theo món (`view=item`), thay bằng popup "Ai đăng ký món"; link cũ về Kỳ tháng.
