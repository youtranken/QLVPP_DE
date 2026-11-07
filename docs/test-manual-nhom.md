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
| 1 | Kỳ 11 đang mở | Đã sửa xong (07/11), chờ chủ dự án thử lại |
| 2 | Sau khi khóa kỳ 11 | Chưa thử |
| 3 | Gửi ADM | Chưa thử |
| 4 | Hàng về và Tủ / Kho | Chưa thử |
| 5 | Giao hàng | Chưa thử |
| 6 | Sang tháng sau (kỳ 12) | Chưa thử |
| 7 | Báo cáo và Nhật ký | Chưa thử |

## Nhóm 1 · Kỳ 11 đang mở

1. `nv.a`: Đăng ký 3–4 món + 1 "Món khác", bấm "Lưu phiếu" → phiếu đã lưu, sửa lại được.
2. `nv.b`, `nv.c`: đăng ký vài món, ít nhất 1 món trùng `nv.a`.
3. `nv.d`: không đăng ký.
4. `hc.test` Tháng này → "x/N đã đăng ký"; bước Đăng ký ghi "Đang chờ chốt kỳ (tháng 11)".
5. `hc.test` Tổng hợp kỳ, chọn tháng 11 (đang mở) → danh sách người đã đăng ký, chỉ xem; "Xem" mở popup phiếu.
6. `hc.test` Sản phẩm (Lưới): "Tạm ngưng" 1 món → thẻ có dấu đỏ chéo (không gạch tên), vẫn hiện tại chỗ, nút "Tạm ngưng" chỉ đỏ khi rê chuột, có "Hoàn tác"; `nv.a` thấy món có dấu Tạm ngưng, không thêm được, phiếu báo đỏ. Bấm "Dùng lại".
7. `hc.test` Sản phẩm (Bảng): tick 1 món hoặc cả nhóm để tạm ngưng; tab Tạm ngưng chỉ có "Dùng lại", "Chuyển nhóm".
8. `hc.test` Danh mục: tạm ngưng 1 nhóm → nhóm gạch tên + "Đã ngừng"; ở Sản phẩm nhóm tự thu gọn. Bật lại.
9. `hc.test` Sản phẩm: hạ "Tối đa" thấp hơn số `nv.a` đã đặt → `nv.a` thấy dòng báo đỏ trong phiếu.
10. `hc.test` Cấu hình: đổi "Hạn đăng ký" 10 → 8 → kỳ 11 giữ hạn cũ, kỳ 12 áp dụng; đổi lại 10.

Góp ý Nhóm 1 (07/11/2026) → mockup https://claude.ai/artifact/5dwhdPKyhbEJwqkPUABQhv:
- NV: đầu trang nền đặc; Món khác ĐVT + SL một hàng, ĐVT chọn sẵn "cái", "tối đa" chỉ hiện đỏ khi chạm mức; bỏ tab "Tôi" → hộp tài khoản ở đầu trang; phiếu đã lưu chỉ xem + "Sửa phiếu"; báo đỏ món tạm ngưng / tối đa bị hạ; NV vẫn thấy món tạm ngưng.
- HC: Tổng hợp kỳ mở chỉ xem (không phần Chưa đăng ký, cột Nhóm = team từ PMH ID, "Xem" mở popup); đổi tên Danh mục món → Sản phẩm, Nhóm & đơn vị → Danh mục; món/nhóm tạm ngưng hiện dấu đỏ, không ẩn, bỏ nhãn "Ngừng riêng"; bảng: lọc + thao tác chung một thanh sáng; nhóm ngưng không có "+"; trang Danh mục gọn; panel Sửa sản phẩm làm lại; dọn nhóm "PW …" trên dev.

## Nhóm 2 · Sau khi khóa kỳ 11

11. `nv.a` Đăng ký → không sửa được phiếu kỳ 11; kỳ 12 đang mở.
12. `hc.test` Tháng này → thấy số món; bước kế: duyệt món ngoài danh mục.
13. `hc.test` Món ngoài danh mục: Chấp nhận / Từ chối có lý do / "Thêm vào danh mục" → `nv.a` có chuông + Lịch sử.
14. `hc.test` Tổng hợp kỳ → "Điều chỉnh" phiếu `nv.b`, giảm 1 dòng có lý do → `nv.b` có chuông, Lịch sử ghi số cũ → mới + lý do.
15. `hc.test` Tổng hợp kỳ: chế độ "Theo món", "Theo người", các bộ lọc.

## Nhóm 3 · Gửi ADM

16. Gửi ADM → "Đề nghị" mặc định = đăng ký + nợ tháng trước (không trừ tủ).
17. Sửa số 1 món → dòng báo đủ / thiếu / dư (có tính tủ).
18. "Xem ai đăng ký", "Lọc theo lệch số".
19. Sửa mọi món về 0 → "In trình ký" tắt, hiện "Tháng này không cần đề nghị ADM"; thử rồi đặt lại số.
20. "In trình ký" → hộp in, A4 có 3 ô ký → băng xanh "Đã gửi ADM lúc …".
21. "Xuất Excel bản này" → đúng bản vừa gửi.
22. Giảm 1 dòng ở Tổng hợp sau khi in → cảnh báo "hàng về dư n vào kho"; Gửi ADM "Có thay đổi sau bản chốt".
23. "Làm bản mới", sửa 1 số, in → liệt kê thay đổi; tờ in "Thay thế bản in lúc …".

## Nhóm 4 · Hàng về và Tủ / Kho

24. Hàng về: ô "Về đợt này" điền sẵn theo bản in; chip nhóm, tìm "but bi", "Chỉ món chưa về đủ".
25. "ADM hết hàng" 1 món → ô về 0 và khóa.
26. Về ít hơn bản in, ghi chú, "Lưu hàng về" → "Thiếu n so với bản in", Tủ cộng đúng.
27. Về nhiều hơn + thêm món ngoài bản in → "Dư … vào kho", "nhập thẳng vào tủ"; "Điền lại số gợi ý".
28. Khối món ngoài danh mục: "Ghi" số đã về → Tủ không đổi.
29. "Đủ hàng" → "Nhập vào tủ" → Tháng này bước Hàng về "Đủ hàng".
30. Tủ / Kho, Tồn kho: Trong tủ = Đang giữ + Còn trống.
31. "Xuất lẻ một món" cho `nv.d` có lý do → Tủ giảm; `nv.d` Lịch sử "Nhận lẻ".
32. Xuất lẻ quá "Còn trống" → cảnh báo, nút "Vẫn xuất".
33. ⋯ → "Kiểm kê": đúng tồn → báo khớp; ít hơn → bắt lý do, Sổ cái "Điều chỉnh".
34. ⋯ → "Nhập ngoài kỳ (tự mua lẻ)" → Tủ tăng, Sổ cái "Nhập mua".
35. Lọc "Sắp hết" ở Tủ, so với Tháng này và Sản phẩm → cùng danh sách.

## Nhóm 5 · Giao hàng

36. Giao hàng: tab "Chưa nhận", "Còn nợ", "Đã nhận", "Tất cả"; ô tìm.
37. Giao đủ cho `nv.a` → chuông "đã được giao đủ".
38. Giao cho người đăng ký sau ở món tủ không đủ → "Giữ k cho m người đăng ký trước"; người đó còn "Chưa nhận".
39. Gõ số quá tủ / quá cần → bị chặn "Tối đa n".
40. Người có món "ADM hết hàng" → giao từ tủ, hủy phần thiếu; NV Lịch sử "Đã hủy — ADM hết hàng", không thành nợ.
41. Còn nợ (kỳ 10, demo): "Giao bổ sung"; "Hủy nợ" có lý do; "Khác" để trống bị chặn.
42. Tủ / Kho, Sổ cái: Nhập / Giao / Xuất lẻ, mỗi dòng có "tồn n".

## Nhóm 6 · Sang tháng sau (kỳ 12)

43. Giao hàng, Còn nợ → "Chưa nhận" kỳ 11 thành "Còn nợ".
44. `nv.b` Đăng ký → dải cam "Bạn còn chờ nhận Tháng 11 … Không cần đăng ký lại".
45. Phần "ADM hết hàng" chưa giao tự hủy, không thành nợ; Nhật ký "Tự hủy …".
46. Gửi ADM kỳ 12 tự cộng nợ; phần ADM còn nợ giao không bị đề nghị lại.
47. Hàng về, "Về bù kỳ trước": nhập, "Lưu về bù" → Tủ cộng.
48. "ADM không giao nữa" → phần NV đang chờ cộng vào đề nghị kỳ 12; thử "Hoàn tác".
49. Còn nợ, lọc "Của người đã nghỉ" (nhờ Claude đánh dấu 1 nhân viên demo đã nghỉ).

## Nhóm 7 · Báo cáo và Nhật ký

50. Báo cáo & in: Phần 1 theo món, Phần 2 theo phòng ban; không sửa số.
51. "In lại bản lập …" bản cũ → số lúc chốt, không đổi.
52. Nhật ký, "7 ngày qua" → đủ việc vừa làm, mỗi dòng có "Trước / Sau".
53. Sổ cái 1 món: tủ đầu + nhập − giao − xuất lẻ ± kiểm kê = tủ cuối.

### Chốt thêm (07/11, sau khi soi bằng evondevKit)
- Nút "Tạm ngưng" trên thẻ/dòng: màu trung tính, chỉ đỏ khi rê chuột; bấm xong có thông báo kèm "Hoàn tác". (Thay cho nút đỏ sẵn.)
- Tài khoản: máy tính bỏ tab "Tôi", bấm tên ở góc phải mở hộp tài khoản; điện thoại giữ 3 mục, bấm "Tôi" mở hộp từ dưới lên.
- Trong 10 cải thiện toàn dự án, làm luôn cùng Nhóm 1 các mục chạm màn Nhóm 1: (2) một kiểu "đang chọn" trên các màn Nhóm 1, (3) header NV nền đặc, (4) nút nguy hiểm trung tính + Hoàn tác, (5) một nhãn "Tạm ngưng". Các mục còn lại (1, 6, 8, 9, 10) làm thành một đợt riêng sau Nhóm 7; mục (7) bỏ gạch dài gộp vào đợt rà câu chữ cuối cùng.
