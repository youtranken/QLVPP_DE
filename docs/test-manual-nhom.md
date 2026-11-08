# Test tay VPP theo nhóm

Chủ dự án thử tay từng nhóm trên dev. Xong một nhóm (sửa hết góp ý, thử lại đạt) mới sang nhóm sau.

- Dev: `https://dev-vpp.pmh.com.vn:8443` → mục "Tài khoản thử (chỉ bản dev)".
- Tài khoản local (mật khẩu chung, xem `test-accounts.local.md`): `hc.test` (Hành chính), `nv.a` `nv.b` `nv.c` `nv.d` (Nhân viên).
- HC dùng cửa sổ thường, NV dùng cửa sổ ẩn danh.
- Bước "khóa kỳ": nhắn Claude ("khóa kỳ 11", "khóa kỳ 12"); Claude sao lưu DB dev rồi đổi hạn kỳ.
- Góp ý của chủ dự án ghi ở `Test manual VPP.docx` (thư mục gốc dự án).

## Trạng thái

| Nhóm | Nội dung | Trạng thái |
|---|---|---|
| 1 | Kỳ 11 đang mở | Đạt (08/11, sau 2 vòng sửa) |
| 2 | Sau khi khóa kỳ 11 | Đang thử (kỳ 11 khóa lúc 00:00 08/11 trên dev) |
| 3 | Gửi ADM | Chưa thử |
| 4 | Hàng về và Tủ / Kho | Chưa thử |
| 5 | Giao hàng | Chưa thử |
| 6 | Sang tháng sau (kỳ 12) | Chưa thử |
| 7 | Báo cáo và Nhật ký | Chưa thử |

## Nhóm 1 · Kỳ 11 đang mở

1. `nv.a`: Đăng ký 3–4 món + 1 "Món khác", bấm "Lưu phiếu" → phiếu đã lưu, sửa lại được.
2. `nv.b`, `nv.c`: đăng ký vài món, ít nhất 1 món trùng `nv.a`.
3. `nv.d`: không đăng ký.
4. `hc.test` Kỳ tháng → "x/N đã đăng ký"; bước Đăng ký ghi "Đang chờ chốt kỳ (tháng 11)".
5. `hc.test` Kỳ tháng, chọn tháng 11 (đang mở) → danh sách người đã đăng ký, chỉ xem; "Xem" mở popup phiếu.
6. `hc.test` Sản phẩm (Lưới): "Tạm ngưng" 1 món → thẻ có dấu đỏ chéo (không gạch tên), vẫn hiện tại chỗ, nút "Tạm ngưng" chỉ đỏ khi rê chuột, có "Hoàn tác"; `nv.a` thấy món có dấu Tạm ngưng, không thêm được, phiếu báo đỏ. Bấm "Dùng lại".
7. `hc.test` Sản phẩm (Bảng): tick 1 món hoặc cả nhóm để tạm ngưng; tab Tạm ngưng chỉ có "Dùng lại", "Chuyển nhóm".
8. `hc.test` Danh mục: tạm ngưng 1 nhóm → nhóm gạch tên + "Đã ngừng"; ở Sản phẩm nhóm tự thu gọn. Bật lại.
9. `hc.test` Sản phẩm: hạ "Tối đa" thấp hơn số `nv.a` đã đặt → `nv.a` thấy dòng báo đỏ trong phiếu.
10. `hc.test` Cấu hình: đổi "Hạn đăng ký" 10 → 8 → kỳ 11 giữ hạn cũ, kỳ 12 áp dụng; đổi lại 10.

Góp ý Nhóm 1 (07/11/2026) → mockup https://claude.ai/artifact/5dwhdPKyhbEJwqkPUABQhv:
- NV: đầu trang nền đặc; Món khác ĐVT + SL một hàng, ĐVT chọn sẵn "cái", "tối đa" chỉ hiện đỏ khi chạm mức; bỏ tab "Tôi" → hộp tài khoản ở đầu trang; phiếu đã lưu chỉ xem + "Sửa phiếu"; báo đỏ món tạm ngưng / tối đa bị hạ; NV vẫn thấy món tạm ngưng.
- HC: Tổng hợp kỳ mở chỉ xem (không phần Chưa đăng ký, cột Nhóm = team từ PMH ID, "Xem" mở popup); đổi tên Danh mục món → Sản phẩm, Nhóm & đơn vị → Danh mục; món/nhóm tạm ngưng hiện dấu đỏ, không ẩn, bỏ nhãn "Ngừng riêng"; bảng: lọc + thao tác chung một thanh sáng; nhóm ngưng không có "+"; trang Danh mục gọn; panel Sửa sản phẩm làm lại; dọn nhóm "PW …" trên dev.

## Nhóm 2 · Sau khi khóa kỳ 11 (màn Kỳ tháng, vòng 3)

11. `nv.a` Đăng ký → không sửa được phiếu kỳ 11; kỳ 12 đang mở. Màn Đăng ký rộng hết bề ngang; dải "đang giao" ở đầu trang bấm vào mở popup nhận hàng (bảng Món · Được giao · Đã nhận · Tình trạng).
12. `hc.test` Kỳ tháng (`/admin/month`): dải 4 bước, bảng kẻ ô, chip lọc; không còn chữ lẻ ("n món, n đơn vị", "chưa đủ tủ…"). Menu Hằng tháng chỉ 5 mục: Kỳ tháng · Báo cáo & gửi ADM · Hàng về · Giao hàng · Còn nợ. Gõ tay `/admin`, `/admin/home`, `/admin/summary`, `/admin/send-adm` → chuyển đúng `/admin/month` hoặc `/admin/reports`, giữ `?ym`.
13. `hc.test` Món ngoài danh mục (menu Tủ và danh mục): Chấp nhận / Từ chối có lý do / "Thêm vào danh mục" → `nv.a` có chuông + Lịch sử.
14. `hc.test` Kỳ tháng → "Điều chỉnh" phiếu `nv.b`, giảm 1 dòng. Lý do chỉ có "Không có hàng" và "Khác" (Khác bắt ghi chú từ 3 chữ, lỗi hiện dưới ô); dòng vượt tối đa chọn sẵn "Khác" + "Vượt tối đa n". "Người đã nghỉ" chỉ xuất hiện khi chủ phiếu đã nghỉ. `nv.b` có chuông; Lịch sử ghi "Điều chỉnh của Hành chính · tên a thành b · Lý do …".
15. `hc.test` Kỳ tháng: tìm theo tên hoặc phòng ban, chip lọc; nút "Tháng trước" dừng ở kỳ cũ nhất; chọn kỳ đang mở → chỉ xem (Đã đăng ký / Chưa đăng ký). `?left=1` chỉ liệt kê người đã nghỉ.

## Nhóm 3 · Báo cáo & gửi ADM

16. `hc.test` Báo cáo & gửi ADM (`/admin/reports`): "Đề nghị" mặc định = đăng ký + nợ tháng trước (không trừ tủ); một dòng trạng thái duy nhất.
17. Sửa số "Đề nghị" ngay trong bảng 1 món → dòng báo đủ / thiếu / dư (có tính tủ).
18. Bấm "n người" ở một món → popup "Ai đăng ký món"; kiểm số người khớp, người bị bỏ dòng (về 0) không có trong popup.
19. Sửa mọi món về 0 → "In trình ký" tắt, hiện "Tháng này không cần đề nghị ADM"; đặt lại số.
20. "In trình ký" → hộp in, A4 có 3 ô ký → băng xanh "Đã gửi ADM lúc …"; "Xuất Excel" đúng bản vừa gửi.
21. Sau khi đã gửi: Đề nghị vẫn sửa được (khởi tạo từ bản đã gửi), không còn bước "Lập bản mới"; sửa 1 số rồi In/Xuất → bản mới (tờ in "Thay thế bản in lúc …", liệt kê thay đổi). Rời trang khi còn số chưa lưu → hỏi xác nhận, đếm đúng số món đã gõ.
22. Giảm 1 dòng ở Kỳ tháng sau khi in → cảnh báo "hàng về dư n vào kho"; trang báo "Có thay đổi sau bản chốt". Các bản đã chốt nằm trong hộp gập "Bản đã lập".

## Nhóm 4 · Hàng về và Tủ / Kho

23. Hàng về: một cột nhập "Hàng về", điền sẵn theo bản in; đã về trước ghi nhỏ dưới "Đề nghị"; chip nhóm, tìm "but bi", "Chỉ món chưa về đủ". Nút duy nhất "Lưu hàng về", dòng "Đợt này: n món · u đơn vị".
24. "ADM hết hàng" 1 món → ô về 0 và khóa.
25. Nhập thấp hơn số còn cần → mới hiện cột "Còn thiếu" (đủ thì không có cột); ghi chú, "Lưu hàng về" → Tủ cộng đúng. Không có "Hoàn tác", "Đủ hàng", "Đặt lại".
26. Nhập nhiều hơn + thêm món ngoài bản in → "Dư … vào kho", "nhập thẳng vào tủ".
27. Khối món ngoài danh mục: "Ghi" số đã về → Tủ không đổi.
28. Tủ / Kho: một hàng chip có số (Tất cả, Sắp hết, …) cạnh ô tìm; bấm chip lọc đúng, "Tất cả" chỉ bỏ lọc; Trong tủ = Đang giữ + Còn trống. Không còn link "Hàng ADM về?".
29. "Xuất lẻ một món" cho `nv.d` có lý do → Tủ giảm; `nv.d` Lịch sử "Nhận lẻ"; xuất quá "Còn trống" → cảnh báo, nút "Vẫn xuất".
30. ⋯ → "Kiểm kê": đúng tồn → báo khớp; ít hơn → bắt lý do, Sổ cái "Điều chỉnh".
31. ⋯ → "Nhập ngoài kỳ (tự mua lẻ)" → Tủ tăng, Sổ cái "Nhập mua"; lọc "Sắp hết" so với Sản phẩm → cùng danh sách.

## Nhóm 5 · Giao hàng

32. Giao hàng (`/admin/delivery`): bảng người nhận có ô chọn từng dòng, chọn tất cả (điện thoại có ô "Chọn tất cả người giao được"), chip lọc, ô tìm; không còn chữ mô tả đầu trang.
33. Chọn 2 người → nút ghi đúng "Giao 2 phiếu" (n = số người chọn, không có chữ "Đã chọn … đơn vị"); xác nhận → mỗi phiếu một kết quả, `nv.a` có chuông "đã được giao đủ".
34. Giao nhiều phiếu khi tủ thiếu → giao phần có, phần thiếu vẫn "Chưa nhận" (kỳ đang giao) rồi thành "Còn nợ"; người đăng ký trước được giữ trước ("Giữ k cho m người đăng ký trước").
35. Mở một người (hộp giao từng người): gõ số quá tủ / quá cần → bị chặn "Tối đa n".
36. Người có món "ADM hết hàng" → giao ở hộp từng người, hủy phần thiếu; NV Lịch sử "Đã hủy — ADM hết hàng", không thành nợ. Người chỉ có dòng này không chọn được trong "Giao n phiếu".
37. Bấm "Giao n phiếu" hai lần liên tiếp (hoặc hai tab) → lần sau báo dữ liệu đã đổi, không giao đôi.
38. Còn nợ (`/admin/backlog`): nhóm tháng → người → món; đầu trang gọn; "Giao bổ sung"; "Hủy nợ" có lý do; "Khác" để trống bị chặn. `?ym=` tháng không còn nợ → rơi về tháng còn nợ.
39. `nv.a` Lịch sử (máy tính): danh sách tháng bên trái (nhóm theo năm) + chi tiết phiếu bên phải; tháng không có phiếu không hiện; chi tiết có "Điều chỉnh của Hành chính" và cột Tình trạng, Ghi chú "Nhận hh:mm dd/mm". Điện thoại: danh sách → chạm tháng → chi tiết, "← Lịch sử".
40. Tủ / Kho, Sổ cái: Nhập / Giao / Xuất lẻ, mỗi dòng có "tồn n".

## Nhóm 6 · Sang tháng sau (kỳ 12)

41. Giao hàng, Còn nợ (nhóm tháng → người → món) → "Chưa nhận" kỳ 11 thành "Còn nợ".
42. `nv.b` Đăng ký → dải nhận hàng có link ngắn tới các tháng còn chờ nhận ("Không cần đăng ký lại"); không có băng thứ hai.
43. Phần "ADM hết hàng" chưa giao tự hủy, không thành nợ; Nhật ký "Tự hủy …".
44. Báo cáo & gửi ADM kỳ 12 tự cộng nợ; phần ADM còn nợ giao không bị đề nghị lại.
45. Hàng về, "Về bù kỳ trước": nhập, "Lưu về bù" → Tủ cộng.
46. "ADM không giao nữa" → phần NV đang chờ cộng vào đề nghị kỳ 12; thử "Hoàn tác".
47. Còn nợ, lọc "Của người đã nghỉ" (nhờ Claude đánh dấu 1 nhân viên demo đã nghỉ).

## Nhóm 7 · Báo cáo và Nhật ký

48. Báo cáo & gửi ADM, hộp "Bản đã lập": Phần 1 theo món, Phần 2 theo phòng ban của bản đã chốt; không sửa số.
49. "In lại bản lập …" bản cũ → số lúc chốt, không đổi.
50. Nhật ký, "7 ngày qua" → đủ việc vừa làm, mỗi dòng có "Trước / Sau".
51. Sổ cái 1 món: tủ đầu + nhập − giao − xuất lẻ ± kiểm kê = tủ cuối.

### Chốt thêm (07/11, sau khi soi bằng evondevKit)
- Nút "Tạm ngưng" trên thẻ/dòng: màu trung tính, chỉ đỏ khi rê chuột; bấm xong có thông báo kèm "Hoàn tác". (Thay cho nút đỏ sẵn.)
- Tài khoản: máy tính bỏ tab "Tôi", bấm tên ở góc phải mở hộp tài khoản; điện thoại giữ 3 mục, bấm "Tôi" mở hộp từ dưới lên.
- Trong 10 cải thiện toàn dự án, làm luôn cùng Nhóm 1 các mục chạm màn Nhóm 1: (2) một kiểu "đang chọn" trên các màn Nhóm 1, (3) header NV nền đặc, (4) nút nguy hiểm trung tính + Hoàn tác, (5) một nhãn "Tạm ngưng". Các mục còn lại (1, 6, 8, 9, 10) làm thành một đợt riêng sau Nhóm 7; mục (7) bỏ gạch dài gộp vào đợt rà câu chữ cuối cùng.

## Góp ý vòng 3 (08/11, Nhóm 2–5) → mockup "Vòng 3" cùng link
Chủ dự án duyệt mockup với các chỉnh:
- Hàng về: gộp "Đã về trước" và "Hàng về đợt này" thành một cột "Hàng về" (nhập số đợt này; đã về trước ghi nhỏ dưới Đề nghị). Chỉ khi nhập thấp hơn số còn cần mới hiện thêm cột "Còn thiếu". Không có Hoàn tác.
- Giao hàng: bỏ chữ "Đã chọn 2 · 41 đơn vị", nút chỉ ghi "Giao 2 phiếu".
- Kỳ tháng: bỏ các chữ lẻ ("· 21 món, 143 đơn vị ·", "3 món chưa đủ tủ cho người chờ · Xem Tủ / Kho").
- Mặc định do Claude chọn (chủ dự án chưa trả lời): giao nhiều phiếu khi tủ thiếu → giao phần có, phần thiếu vào Còn nợ (đúng FR-42/PRD); sửa Đề nghị ngay trong bảng Báo cáo & gửi ADM; Lịch sử NV ẩn tháng không có phiếu.
- "Còn nợ" = Hành chính còn nợ nhân viên (dòng chưa giao đủ của các kỳ trước), không phải ADM nợ Hành chính.
