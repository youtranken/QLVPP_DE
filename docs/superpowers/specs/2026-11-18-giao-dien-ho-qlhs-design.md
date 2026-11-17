# Giao diện VPP theo họ QLHS/QLTS — thiết kế

Ngày 18/11/2026. Nguồn: trang rà soát Trước/Sau (artifact `9tSeCyKhUDVYcfgUP9sJGA`, bản 5) và trao đổi với chủ dự án ngày 17–18/11.

## Vì sao

VPP là app duy nhất trong họ D&E (PMH ID, QLHS, QLTS, QLVPP) đi đường riêng: nền teal tối, tấm nội dung nổi, 8 kiểu "đang chọn", nút thừa lặp chỗ khác. QLHS và QLTS dùng chung một bộ token đến từng mã màu. Người dùng đi qua lại giữa ba app phải thấy cùng một nhà; Adm D&E cần ít nút thừa, mỗi việc một lối.

## Quyết định của chủ dự án

1. **Mã màu lấy theo QLHS/QLTS** (TC-00): primary `#1d4ed8` (hover `#1e40af`, press `#1e3a8a`, ink `#1e3a8a`, soft `#eff4ff`, border `#c7d7fe`); rail/sidebar navy `#0f1f3d`, chữ trên rail `rgba(255,255,255,.76)`, nền mục active `rgba(255,255,255,.1)`, vạch active `#60a5fa`; canvas `#f3f6fb`, surface `#ffffff`, surface-2 `#f7f9fc`; ink `#111a2c` / ink-2 `#364258` / muted `#5a6680`; border `#dde3ee` / border-strong `#c6cfdf`; ok `#067647`/`#ecfdf3`/`#abefc6`, warn `#b54708`/`#fffaeb`/`#fedf89`, danger `#b42318`/`#fef3f2`/`#fecdca`, info `#0e7490`/`#ecfeff`; số đếm cần chú ý `#fdb022`. Font giữ Be Vietnam Pro. **Thang bo góc A (chốt 15/11) giữ nguyên**: nút/ô nhập/chip `--r-sm` 6, thẻ/bảng/menu `--r-md` 8, hộp thoại/ngăn kéo `--r-xl` 12, pill chỉ cho nhãn trạng thái/số đếm/avatar — chủ dự án 18/11 muốn chip "bo 6 vuông vức, không bo tròn"; chỗ nào trên trang rà soát ghi "bo 8" cho nút (TN-02, TN-07, TN-10, TN-14) thì đọc là 6.
2. **Vạch trái 3px** (chủ dự án thích): `::before`/`inset box-shadow` 3px, bo `0 3px 3px 0`, cách trên dưới 8px — cho mục sidebar đang chọn, danh sách dọc đang chọn, dòng bảng cần chú ý (cam = người đã nghỉ, đỏ = quá hạn/chờ lâu), mục đang trỏ trong Ctrl K.
3. **Luật "đang chọn" 3 kiểu** (TC-03):
   - A. Điều hướng trên nền tối: nền trắng 10% + vạch `#60a5fa` 3px (sidebar: trái; tab thanh trên nhân viên: dưới; thanh dưới 390: trên).
   - B. Chọn để xem/lọc trên nền sáng: nền primary-soft + viền primary-border + chữ primary-ink, đậm 600, **bo 6 vuông vức, không bo tròn** (chip lọc, chip nhóm, Theo người/Theo món, Lưới/Bảng, thẻ số làm bộ lọc). Danh sách dọc thêm vạch trái.
   - C. Chọn một giá trị (VI/EN, ô tháng trong bộ chọn, số trang): nền primary đặc, chữ trắng.
   - **Ngoại lệ:** thẻ món đã chọn ở trang Đăng ký giữ **nền cam nhạt, viền cam** cho nổi giữa các món; **bỏ số tròn trên ảnh** vì bộ −/+ đã có số (NV-15).
   - Bỏ hẳn nền tối `#0E2A33` cho chip, nền trắng nổi trên rãnh xám, viền 2px, kính mờ.
4. Mọi mục còn lại trên trang rà soát được duyệt như bản "Sau" (chủ dự án: "các chỗ còn lại khá ok"). Mục cờ `spec` ghi `docs/review-spec.md` trước khi sửa code; mục cờ `hoi` làm như bản Sau.
5. TN-04 đổi theo TC-13: nút nguy hiểm trong hàng = chữ đỏ + viền đỏ nhạt; nút xác nhận cuối trong hộp = đỏ đặc.
6. AD-33: nút thoát của hộp Hủy nợ ghi **"Quay lại"** (không "Hủy" để khỏi lẫn với "Hủy nợ") — đề xuất của Claude, chờ chủ dự án phản đối nếu không đồng ý.

## Không làm

- Không đổi luật nghiệp vụ, mã lỗi, endpoint có sẵn (trừ 3 chỗ dưới).
- Không thêm thư viện UI/CSS; icon dùng bộ `web/src/ui/icon-paths.ts` sẵn có.
- Không dark mode (QLTS/QLHS có, VPP chưa cần).

## Chạm server (3 chỗ)

- AD-40: `stock-query.service.ts` trả `actor_name` = `coalesce(full_name, actor_sub)` như `arrivals-plan.queries.ts` (SA local không có trong `users` nên đang ra "—").
- NV-03: lưu phiếu thành công → chuông nhắc "chưa đăng ký tháng X" của người đó tự đánh dấu đã đọc, ép ở server trong cùng transaction lưu phiếu.
- TC-18: Hoàn tác 5 giây cho giao hàng / hủy nợ / xóa món — cần endpoint hoàn tác; làm cuối, có thể tách nếu tốn.

## Cách làm (các hướng đã cân nhắc)

- **Thay khối token + sửa từng màn (chọn).** `tokens-m1.css` đã gom bảng màu một khối ("thay cả khối khi đổi bảng màu"); hầu hết CSS dùng biến. Đổi khối token trước, rồi đổi component dùng chung (`ui/*`), cuối cùng từng màn. Rủi ro thấp, review theo giai đoạn được.
- Viết lại CSS theo file token của QLHS: nhanh lúc đầu nhưng phá tên biến mà 13 màn + test tương phản đang dùng. Loại.
- Chép component QLTS/QLHS: khác stack router/khung (QLHS không dùng react-router). Loại.

## Danh sách mục đã duyệt

### Mục 1 — học từ QLTS/QLHS (TC)

| ID | Phần | Gợi ý đã duyệt | Cờ |
|---|---|---|---|
| TC-00 | Màu nhấn theo họ QLTS/QLHS | Đổi xanh ngọc #0E6A7B sang xanh dương #1D4ED8, sidebar navy #0F1F3D, nền trang xám xanh #F3F6FB. Ba phần mềm D&E cùng một bộ màu | spec |
| TC-01 | Khung trang: nền sáng, thanh trên trắng | Bỏ nền tối và tấm nội dung nổi. Thay bằng: sidebar navy, thanh trên trắng cao 60 (đường dẫn "QLVPP › Kỳ tháng", tìm nhanh, chuông, ảnh đại diện), nội dung đặt thẳng trên nền sáng | spec |
| TC-02 | Mục sidebar đang chọn: vạch trái | Mục đang chọn: nền trắng 10%, chữ trắng, vạch 3px xanh sáng sát mép trái, cách trên dưới 8px. Thay cho nền trắng đặc chữ tối như hiện giờ |  |
| TC-03 | Luật "đang chọn" mới, thay TN-01 | Còn 3 kiểu cho cả app. A: điều hướng trên nền tối dùng vạch sáng. B: chọn để xem/lọc trên nền sáng dùng nền xanh nhạt + viền xanh, bo 6 vuông vức (không bo tròn); danh sách dọc thêm vạch trái. Riêng thẻ món đã chọn ở Đăng ký: nền cam nhạt viền cam. C: chọn một giá trị (VI/EN, ô tháng) dùng nền xanh đặc. Bỏ hẳn nền tối #0E2A33 cho chip |  |
| TC-13 | Một bộ nút | Mỗi màn đúng một nút xanh đặc ở góc phải đầu trang. Nút phụ viền mảnh. Xóa/hủy trên dòng: chữ đỏ viền đỏ nhạt. Cao 36/40/44, bo 8 |  |
| TC-09 | Một khuôn nhãn trạng thái | Nhãn viên thuốc cao 22, chấm 6px, 5 tông: xanh lá xong, cam thiếu, đỏ hết/quá hạn, xanh đang chạy, xám chưa bắt đầu |  |
| TC-12 | Đang tải / rỗng / lỗi một bộ | Khối nào cũng có ba trạng thái cùng khuôn: khung xám giữ chỗ, rỗng có câu "làm gì tiếp" + nút, lỗi có "Thử lại" |  |
| TC-04 | Thẻ số làm bộ lọc (Giao hàng, Danh bạ) | Thay hàng nút "Chưa nhận / Đã nhận…" bằng một hàng thẻ số: bấm thẻ là lọc bảng. Thẻ đang chọn nền xanh nhạt viền xanh. Thẻ báo động (người đã nghỉ) nền đỏ nhạt |  |
| TC-05 | Kỳ tháng: 4 ô bước thành dải tiến trình | Đặt hàng → Gửi NCC → Nhận hàng → Giao là một dải chấm nối nhau: bước qua có ✓ xanh lá, bước đang làm có quầng xanh |  |
| TC-06 | Trang "Việc hôm nay" cho Adm D&E | Thêm trang đầu tiên khi Adm D&E vào app: 8 ô số (món ngoài DM chờ duyệt, giao được ngay, hàng NCC chưa về, còn nợ, kỳ đang đăng ký, tủ sắp hết, người nghỉ còn phần, thư lỗi) và danh sách "Cần chú ý" có nút làm luôn | hoi |
| TC-07 | Một khuôn bảng cho mọi màn | Đầu cột nền xám nhạt, dòng cao 52, bỏ ô chữ cái tròn, số canh đều chữ số, cột ⋯ ghim mép phải |  |
| TC-08 | Dòng cần chú ý: vạch trái màu | Người đã nghỉ, món chờ duyệt lâu: vạch 3px ở cạnh trái dòng + nền nhạt cùng tông. Băng cam ở đầu trang rút còn 1 dòng, không kể tên |  |
| TC-10 | Một khuôn thanh lọc | Khung trắng chứa ô tìm + các ô chọn, đổi là lọc ngay. Dưới đó hàng "Đang lọc" có chip gỡ được và số dòng |  |
| TC-11 | Sửa món/nhóm bằng ngăn kéo bên phải | Bấm Sửa ở Sản phẩm, Danh mục mở ngăn kéo rộng 560 bên phải, bảng vẫn thấy phía sau. Form chia mục có tiêu đề chữ hoa | hoi |
| TC-16 | Bảng thành thẻ ở 390 | Ở điện thoại, mỗi dòng Danh bạ/Nhật ký/Tủ thành một thẻ "nhãn · giá trị", dòng cần chú ý vẫn có vạch trái |  |
| TC-17 | Tìm nhanh Ctrl K | Ô "Tìm nhanh" trên thanh trên: gõ tên món, người, kỳ để nhảy tới | hoi |
| TC-18 | Thông báo có Hoàn tác | Giao, hủy nợ, xóa món: thông báo tối ở đáy kèm "Hoàn tác" 5 giây, thay hộp hỏi lại cho việc làm lại được | hoi |
| TC-14 | Trang Đăng ký 1280 theo họ | Thanh trên navy với tab "Đăng ký / Lịch sử" gạch dưới xanh sáng; nội dung trên nền sáng; thẻ món đã chọn giữ nền cam nhạt viền cam cho nổi giữa các món (bạn chốt 18/11), bỏ số tròn trên ảnh vì bộ −/+ đã có số; giỏ là tấm trắng, nút "Sửa phiếu" xanh | spec |
| TC-15 | Trang Đăng ký 390 và thanh dưới | Thanh dưới nền navy đặc, mục đang chọn chữ trắng + vạch 3px ở cạnh trên (cùng vạch với sidebar, chỉ đổi cạnh). Thanh "Lưu phiếu" dính ngay trên thanh dưới |  |

### Adm D&E

| ID | Màn · phần | Gợi ý đã duyệt | Cờ |
|---|---|---|---|
| AD-01 | Khung chung (sidebar, thanh trên 390) · Số "2" cam ở mục Kỳ tháng | Bấm vào phải mở đúng kỳ có món chờ duyệt và bật lọc "Có món chờ duyệt"; không làm được thì bỏ số |  |
| AD-02 | Khung chung (sidebar, thanh trên 390) · Số "5" xám ở mục Giao hàng | Dùng cùng số với chip "Chưa nhận 12" trên trang, hoặc đổi chữ đọc màn hình thành "5 người giao được ngay" |  |
| AD-03 | Khung chung (sidebar, thanh trên 390) · Dòng phụ thanh trên 390 | Mọi màn ghi giống nhau "Kỳ hiện tại: tháng 1 · đang mở" |  |
| AD-04 | Kỳ tháng · Bộ chọn tháng ở đầu trang | Dời xuống thanh công cụ, cạnh ô tìm |  |
| AD-05 | Kỳ tháng · Nút "Xem nợ tháng trước" trong băng cam | Bỏ |  |
| AD-06 | Kỳ tháng · Nút "Xử lý" trong băng cam | Đổi chữ thành "Lọc 8 người này"; khi đang lọc phải có chip sáng đúng |  |
| AD-07 | Kỳ tháng · 8 tên người đã nghỉ kể trong băng cam | Chỉ ghi "8 người đã nghỉ còn phần chưa nhận" |  |
| AD-08 | Kỳ tháng · "+ Thêm khu" | Đổi chữ thành "Lọc phòng", dời vào hàng lọc cạnh chip | spec |
| AD-09 | Kỳ tháng · "Đang hiện 12/12 người" | Chỉ hiện khi đang lọc hoặc tìm | spec |
| AD-10 | Kỳ tháng · Ô tròn chữ cái trên tên người | Bỏ |  |
| AD-11 | Kỳ tháng · Cột "Trạng thái" là chữ xám | Đổi thành nhãn màu như cột Tình trạng ở Nhận hàng |  |
| AD-12 | Kỳ tháng · Kỳ đang đăng ký có bảng khác hẳn, cột chữ "Xem" | Dùng chung bảng với kỳ đang giao: bấm cả dòng để xem, ⋯ cho thao tác |  |
| AD-13 | Kỳ tháng · Ngăn "Phiếu của …" có cả X và nút "Đóng" ở chân | Bỏ "Đóng" ở chân |  |
| AD-14 | Kỳ tháng · Ngăn Điều chỉnh: chữ "Chọn ít nhất một dòng" nằm bên phải nút chính | Dời chữ sang trái hoặc xuống dưới nút |  |
| AD-15 | Báo cáo & gửi NCC · Nút tắt dài "Tháng 1 đang đăng ký — báo cáo sau 00:00 ngày 11/01" | Bỏ; lý do đưa vào chú thích của nút › |  |
| AD-16 | Báo cáo & gửi NCC · Bộ chọn tháng ở đầu trang | Dời xuống thanh công cụ (như AD-04) |  |
| AD-17 | Báo cáo & gửi NCC · "In lại" trên thanh công cụ | Bỏ |  |
| AD-18 | Báo cáo & gửi NCC · "có 17 món đổi sau bản này" | Đổi thành chip lọc "Đã đổi sau bản in (17)" có trạng thái chọn rõ, hoặc bỏ |  |
| AD-19 | Báo cáo & gửi NCC · Nút chính "Xem tổng kết" | Đổi chữ thành "In trình ký" |  |
| AD-20 | Báo cáo & gửi NCC · Cột "Tủ hiện có (tham khảo)" | Đổi chữ thành "Tủ" |  |
| AD-21 | Báo cáo & gửi NCC · Dòng nhóm tô 5 màu, "Khác" đỏ nhạt | Nền trung tính như Nhận hàng |  |
| AD-22 | Báo cáo & gửi NCC · Nút thu/mở (^) mỗi nhóm | Bỏ |  |
| AD-23 | Nhận hàng · Nút "Nhận đủ hàng" đầu mỗi nhóm và ô tick nhóm cạnh nó | Giữ ô tick + thanh dưới, bỏ 5 nút đầu nhóm |  |
| AD-24 | Nhận hàng · Nhãn trạng thái "Nhận đủ hàng" | Đổi chữ thành "Đủ" |  |
| AD-25 | Nhận hàng · Cột "Còn thiếu" | Bỏ |  |
| AD-26 | Nhận hàng · "Đang hiện 29/29 món" | Chỉ hiện khi lọc |  |
| AD-27 | Giao hàng · "1 người có cả hai" dưới chip lọc | Bỏ |  |
| AD-28 | Giao hàng · Nút tắt "Tủ chưa có hàng" thay cho "Giao…" | Vẫn là "Giao…" ở trạng thái tắt, lý do ở chú thích |  |
| AD-29 | Giao hàng · ⋯ → "Xem chi tiết" | Đổi chữ thành "Xem phiếu" |  |
| AD-30 | Giao hàng · Ô tick tắt ở người đã nghỉ | Thêm chú thích lý do khi rê chuột |  |
| AD-31 | Giao hàng · Hộp "Giao cho …?" có nút "Đóng" | Đổi chữ thành "Hủy" |  |
| AD-32 | Còn nợ · Cột "Tủ còn" | Đổi chữ thành "Tủ" |  |
| AD-33 | Còn nợ · Hộp Hủy nợ có nút "Đóng" | Đổi chữ thành "Hủy" |  |
| AD-34 | Còn nợ · "(ít hơn giữa số còn nợ và tồn kho)" trong hộp Giao bổ sung | Đổi thành "Giao được tối đa 6 cuộn — bằng số còn nợ hoặc số trong tủ, lấy số nhỏ hơn" |  |
| AD-35 | Tủ / Kho · Nút "Sản phẩm" ở đầu trang | Bỏ |  |
| AD-36 | Tủ / Kho · Nhãn "Còn 6" ở cột Tình trạng | Bình thường để "—", chỉ hiện nhãn khi Sắp hết / Hết / Thiếu kỳ này |  |
| AD-37 | Tủ / Kho · "Đang hiện 50/56 món" cạnh "Xem thêm (6 món nữa)" | Bỏ dòng "Đang hiện" |  |
| AD-38 | Xuất lẻ · Cả màn Xuất lẻ (mục sidebar riêng) | Gộp vào Tủ/Kho → tab Lịch sử, lọc "Xuất lẻ"; nút "Xuất lẻ một món" lên đầu Tủ/Kho | hoi |
| AD-39 | Xuất lẻ · Nút "Tủ / Kho" ở đầu trang | Bỏ |  |
| AD-40 | Xuất lẻ · Cột "Người xuất" toàn "—" | Kiểm dữ liệu (có thể là lỗi, không phải giao diện) |  |
| AD-41 | Sản phẩm · Nút "Danh mục" ở đầu trang | Bỏ |  |
| AD-42 | Sản phẩm · Nhãn nhóm trên ảnh mỗi thẻ | Bỏ |  |
| AD-43 | Sản phẩm · Nút "Tạm ngưng" trên mỗi thẻ | Bỏ khỏi thẻ, chỉ để trong ngăn Sửa |  |
| AD-44 | Sản phẩm · "Lưới / Bảng" ở điện thoại | Bỏ ở màn hẹp |  |
| AD-45 | Sản phẩm · Mô tả trang 2 câu, 2 dòng | Một dòng: "Thứ tự nhóm ở đây là thứ tự nhân viên thấy; mỗi món cần ảnh." |  |
| AD-46 | Sản phẩm · Nút "Xóa ảnh" trong ngăn Sửa khi ảnh bắt buộc | Bỏ, chỉ giữ "Đổi ảnh" |  |
| AD-47 | Danh mục · "Đang hiện 5/5 nhóm", "17/17 đơn vị" | Bỏ (hoặc chỉ hiện khi tìm) |  |
| AD-48 | Danh bạ · "Đang hiện 14/52 người" | Bỏ |  |
| AD-49 | Danh bạ · Nhãn "Chưa" ở cột "Tháng 1" | Cột "Phiếu tháng 1", nhãn "Chưa đặt" / "Đã đặt" |  |
| AD-50 | Danh bạ · Ngăn Người dùng có X và "Đóng" | Bỏ "Đóng" ở chân |  |
| AD-51 | Nhật ký · Nút chính "Lọc" + "Xóa lọc" | Bỏ "Lọc", lọc ngay khi đổi như mọi màn khác | hoi |
| AD-52 | Nhật ký · Hàng "Nhanh: Hôm nay · 7 ngày qua · Tháng 11" | Gộp vào ô Khoảng ngày; "Đăng nhập bị từ chối" thành một mục trong Hành động |  |
| AD-53 | Nhật ký · Nút "Hệ thống (tự động)" cạnh ô email | Đổi chữ thành "Chỉ việc tự động" |  |
| AD-54 | Nhật ký · "50+ dòng nhật ký" + "50 dòng" + nút thu/mở ngày | Bỏ "50+ dòng nhật ký" và nút thu/mở |  |
| AD-55 | Cấu hình · "Chỉ lưu khối này · ghi vào Nhật ký" lặp 3 lần | Bỏ (hoặc nói một lần ở mô tả trang) |  |
| AD-56 | Cấu hình · Ô ký 3 + "Phiếu chỉ in 2 ô đầu" + "Đã đủ 2 ô in trên phiếu" | Nhãn "Không in" trên ô 3; chữ cạnh nút: "Tối đa 3 ô; phiếu in 2 ô đầu" |  |

### Nhân viên và đăng nhập

| ID | Màn · phần | Gợi ý đã duyệt | Cờ |
|---|---|---|---|
| NV-01 | Khung chung · Bộ đổi VI/EN trên thanh trên (1280) | Dời vào hộp tài khoản (bấm tên), như ở 390 |  |
| NV-02 | Khung chung · Dòng "Phòng D&E" dưới tên trên thanh trên | Bỏ, giữ tên |  |
| NV-03 | Khung chung · Chuông "Bạn chưa đăng ký tháng 1" vẫn chưa đọc sau khi đã lưu phiếu | Sửa: lưu phiếu xong thì chuông nhắc tự coi là đã đọc |  |
| NV-04 | Đăng ký — đầu trang · Hạn sửa nói 3 lần khi đã lưu | Dòng trạng thái chỉ "Đã lưu 18:32"; bỏ ghi chú dưới nút giỏ | spec |
| NV-05 | Đăng ký — đầu trang · "Chưa lưu" báo 4 lần cùng lúc | Bỏ nhãn "Chưa lưu" trên giỏ và "· Chưa lưu" ở thanh nổi; giữ chấm đầu trang và chữ trên nút |  |
| NV-06 | Đăng ký — đầu trang · "Phiếu tháng 12 đã chốt · đã nhận 0/3 món" | Một cách đếm mọi nơi: "Phiếu tháng 12 · còn chờ 3 món" |  |
| NV-07 | Đăng ký — đầu trang · Nút "Xem" trên dải mở hộp "Phiếu tháng 12" | Bỏ hộp, "Xem" mở thẳng Lịch sử tháng 12 |  |
| NV-08 | Đăng ký — đầu trang · (nếu giữ hộp) nút chính "Đóng" + X | Bỏ nút chính "Đóng" |  |
| NV-09 | Đăng ký — thanh lọc và lưới món · Ô sắp xếp "Theo nhóm / Tên A→Z / Hay dùng trước" | Bỏ, cố định theo nhóm |  |
| NV-10 | Đăng ký — thanh lọc và lưới món · Nút "Đã chọn 3" | Bỏ |  |
| NV-11 | Đăng ký — thanh lọc và lưới món · "+ Thêm món khác" có 3 lối | Giữ thẻ cuối lưới + nút trong giỏ; bỏ nút ở thanh lọc | spec |
| NV-12 | Đăng ký — thanh lọc và lưới món · "56 món trong danh mục" | Chỉ hiện "n món khớp" khi đang tìm |  |
| NV-13 | Đăng ký — thanh lọc và lưới món · Chip "Chưa có nhóm 6" | Gộp vào chip "Khác" |  |
| NV-14 | Đăng ký — thanh lọc và lưới món · Nhãn nhóm góc mỗi thẻ | Chỉ hiện khi đang tìm |  |
| NV-15 | Đăng ký — thanh lọc và lưới món · Số cam "3" góc thẻ đã chọn | Bỏ |  |
| NV-16 | Đăng ký — giỏ (1280), thanh nổi (390) · "3 cuộn" dưới tên món khi đang sửa | Bỏ khi sửa, ĐVT đặt cạnh −/+ |  |
| NV-17 | Đăng ký — giỏ (1280), thanh nổi (390) · Giỏ trống: "0 loại món · 0 đơn vị" + "Chưa lưu" | Bỏ cả hai khi giỏ trống |  |
| NV-18 | Đăng ký — giỏ (1280), thanh nổi (390) · Ghi chú dưới nút giỏ | Bỏ |  |
| NV-19 | Đăng ký — giỏ (1280), thanh nổi (390) · Chế độ xem / "Sửa phiếu" làm nửa vời: −/+ trên thẻ vẫn sửa được ngay | Bỏ chế độ xem (giỏ luôn có −/+, nút "Lưu phiếu") — hoặc khóa luôn −/+ trên thẻ khi đang xem | hoi |
| NV-20 | Đăng ký — giỏ (1280), thanh nổi (390) · 390, phiếu đã lưu: nút "Lưu phiếu" mờ trên thanh nổi | Bỏ nút ở trạng thái này |  |
| NV-21 | Đăng ký — giỏ (1280), thanh nổi (390) · 390: nút "1 thay đổi chưa lưu / Lưu phiếu" bẻ 2 dòng chữ nhỏ | Đổi chữ thành "Lưu phiếu" |  |
| NV-22 | Đăng ký — giỏ (1280), thanh nổi (390) · Nút "Hủy" khi đang sửa mà chưa đổi gì là nút to nhất, viền màu nhấn | Đổi thành nút phụ |  |
| NV-23 | Popup kỳ mới · Khối "Phiếu tháng 12: 8 món, đã nhận 1 · Xem phiếu" trong popup | Bỏ |  |
| NV-24 | Popup kỳ mới · Ba tầng chữ: nhãn + tiêu đề + đoạn văn | Gọn còn "Đã mở đăng ký tháng 1 — hạn 23:59 ngày 10/01." |  |
| NV-25 | Lịch sử · Mũi tên ">" mỗi dòng tháng ở 1280 | Bỏ ở màn rộng, giữ ở 390 |  |
| NV-26 | Lịch sử · "· Phòng D&E" trong chi tiết | Bỏ |  |
| NV-27 | Lịch sử · Nhãn "Đã giao 4/9" (danh sách ghi "Còn chờ 3 món") | Đổi thành "Còn chờ 3 món" |  |
| NV-28 | Lịch sử · Cột "Được giao" + "Đã nhận" + "Tình trạng: Chờ 2" | Gộp thành "Đăng ký · Đã nhận · Còn chờ"; "Được giao" chỉ hiện khi khác số đăng ký |  |
| NV-29 | Lịch sử · Cột "Ghi chú" chứa "Nhận 18:31 15/11" | Đổi tiêu đề thành "Nhận lần cuối" |  |
| NV-30 | Lịch sử · 390: mỗi món là thẻ 6 cặp nhãn–giá trị | Một dòng: "Băng keo 5cm · 4 cuộn — đã nhận 2, còn chờ 2" |  |
| NV-31 | Tôi, đăng nhập · "Phòng D&E · Nhân viên" dưới tên | Bỏ "· Nhân viên" |  |
| NV-32 | Tôi, đăng nhập · "Phát triển bởi IT Department" | Đổi thành "Phát triển bởi Phòng IT" (bản vi) |  |
| NV-33 | Tôi, đăng nhập · Màn đăng nhập bắt nhập email trước rồi "Tiếp tục" | Kiểm với _SPEC: nút chính "Đăng nhập bằng Tài khoản D&E", ô email là tùy chọn | spec |

### Thống nhất kiểu nút và nhãn

| ID | Màn · phần | Gợi ý đã duyệt | Cờ |
|---|---|---|---|
| TN-02 | Các họ khác ngoài "đang chọn" · Nút chính (6 kiểu) | Nền xanh đặc, chữ trắng, bo 8, đậm 600, cao 36 (40 cạnh ô nhập, 44 trên điện thoại), không bóng; tắt = mờ + chú thích lý do. Như TC-13 |  |
| TN-03 | Các họ khác ngoài "đang chọn" · Nút phụ / Hủy (5 kiểu) | Một kiểu: nền trắng, viền 1px rõ, chữ đậm, cùng cao với nút chính cạnh nó. Hộp có thao tác ghi "Hủy"; ngăn chỉ xem chỉ có X |  |
| TN-04 | Các họ khác ngoài "đang chọn" · Nút nguy hiểm (4 kiểu) | Trong hàng/chân ngăn: chữ đỏ, viền đỏ nhạt, có hỏi xác nhận; nút xác nhận cuối trong hộp: nền đỏ đặc. Không dùng chữ đỏ trơn không khung. Như TC-13 (đổi từ bản 17/11: trước đề xuất trung tính, đỏ khi rê chuột) |  |
| TN-05 | Các họ khác ngoài "đang chọn" · Liên kết và nút | Chuyển trang = liên kết (chữ gạch chân, không khung); mở hộp hay đổi trạng thái = nút. Không thứ gì vừa có khung vừa gạch chân |  |
| TN-06 | Các họ khác ngoài "đang chọn" · Bộ −/+ (3 cỡ) | Một bộ: nút 40 trên máy tính, 44 trên điện thoại; tắt = mờ .5 |  |
| TN-07 | Các họ khác ngoài "đang chọn" · Nút icon (X, ⋯, chuông) | Cỡ 36/44, bo 8 (không tròn), viền mảnh như QLTS/QLHS |  |
| TN-08 | Các họ khác ngoài "đang chọn" · Nhãn trạng thái — cùng nghĩa cùng màu | Xanh = xong/đủ; cam = cần để ý; đỏ = thiếu thật phải xử lý; xám viền = thuộc tính; bình thường thì không gắn nhãn. Mọi nhãn dạng viên tròn nhỏ |  |
| TN-09 | Các họ khác ngoài "đang chọn" · Số đếm trên sidebar | Một màu cam (việc đang chờ), và số phải trùng một số thấy được ở trang đích |  |
| TN-10 | Các họ khác ngoài "đang chọn" · Bộ chọn tháng | Ở thanh công cụ, cao 36, bo 8 (không phải viên tròn), không gắn nút giải thích |  |
| TN-11 | Các họ khác ngoài "đang chọn" · Dòng tiêu đề nhóm trong bảng | Nền trung tính, tên + số món, không nút thu/mở |  |
| TN-12 | Các họ khác ngoài "đang chọn" · Ô tròn chữ cái trong bảng Adm D&E | Bỏ ở mọi bảng (hoặc nếu giữ: 2 chữ, bên trái, cỡ 32 ở mọi bảng) |  |
| TN-13 | Các họ khác ngoài "đang chọn" · "Đang hiện x/y" | Chỉ hiện khi đang lọc/tìm và x < y, luôn ở cuối thanh công cụ | spec |
| TN-14 | Các họ khác ngoài "đang chọn" · Ô nhập trong hộp "Thêm món khác" | Bo 8, viền 1px cùng màu ô tìm, cao 40 (44 trên điện thoại) |  |
| TN-15 | Các họ khác ngoài "đang chọn" · Màu xanh lục đời trước còn sót | Chỉ dùng bộ màu mới theo QLHS/QLTS (TC-00) |  |