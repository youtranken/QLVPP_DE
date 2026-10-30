# Epic 9 — Giao diện mới Hành chính (M1 · P3 "Navy & cát")

Nguồn: `docs/specs/2026-10-30-giao-dien-moi-hanh-chinh.md`. AC và tên test Playwright chép ở mục SPEC trỏ tới; mỗi lát một nhánh, TDD theo CLAUDE.md, Playwright 1280 + 390.

## E9-S0 Hành chính không có phiếu
SPEC §1.4, §5.0. Playwright: `E9-S0 Hành chính không có phiếu: đăng nhập vào thẳng Tổng hợp, mở / bị đưa về /admin, sidebar không có Phiếu của tôi`.

## E9-S1 Token, shell, thành phần dùng chung
SPEC §5.1 (AC 1–8). Playwright: `E9-S1 shell Hành chính: sidebar 3 nhóm 11 mục, thẻ kỳ, chuông, đổi en đổi nhãn sidebar` · `E9-S1 điểm gãy 767/768 và 1279/1280` · `E9-S1 trang member giữ giao diện cũ`.

## E9-S2 Tổng hợp kỳ + Món ngoài danh mục
SPEC §5.2 (B1, B2; AC E9-S2). Playwright: `E9-S2 Tổng hợp: thẻ lọc dòng chờ giao, chưa đăng ký không có Hành chính, theo món nhóm có tồn` · `E9-S2 Điều chỉnh kỳ khóa: cận dưới đã giao, lý do 2/3 ký tự, lưu ra toast` · `E9-S2 Tạo phiếu hộ: trùng phiếu mở Điều chỉnh` · `E9-S2 Món ngoài danh mục: chấp nhận, từ chối có lý do, thêm vào danh mục món mới`.

## E9-S3 Giao hàng + Còn nợ
SPEC §5.3 (B3, B4; AC E9-S3). Playwright: `E9-S3 Giao hàng: thực giao kẹp theo tồn và còn lại, giao dòng đã chọn, giao tất cả rời bộ lọc` · `E9-S3 Giao hàng bấm đúp: tồn trừ một lần` · `E9-S3 Còn nợ: thẻ lọc, giao bổ sung tối đa min(nợ, tồn), hủy nợ có lý do, lịch sử đợt giao`.

## E9-S4 Báo cáo + Bản in A4 + Excel
SPEC §5.4 (B5, B6; AC E9-S4). Playwright: `E9-S4 Báo cáo: Đặt mua biên 0/99999/100000, chốt hỏi món chưa xem, Excel tải về và tải lại không tạo bản mới` · `E9-S4 Bản in A4: ô ký, số chốt không đổi sau giao thêm, in lại không tạo bản mới` (giữ E5-S2/E5-S3).

## E9-S5 Danh mục + Nhóm món + Kho
SPEC §5.5 (B7, B8, B9; AC E9-S5). Playwright: `E9-S5 Danh mục: sửa tại chỗ tối đa 0/1/999/1000, thêm món có ảnh trong ngăn kéo, hàng loạt đổi tối đa` · `E9-S5 Nhóm món: đổi thứ tự, màu theo vị trí, trùng tên` · `E9-S5 Kho: nhập 10, xuất lẻ 3 rồi 4 bị chặn, sổ cái tồn sau từng dòng`.

## E9-S6 Danh bạ + Nhật ký + Cấu hình
SPEC §5.6 (B10, B11, B12; AC E9-S6). Playwright: `E9-S6 Danh bạ: thẻ lọc trạng thái, đồng bộ lỗi PMH ID bảng vẫn còn, ngăn kéo người` · `E9-S6 Nhật ký: lọc nhanh Hôm nay, khoảng ngày sai báo tại ô, mở Trước/Sau` · `E9-S6 Cấu hình: ngày hạn 2/3/28/29, liên hệ 500 ký tự, mỗi khối lưu riêng`.

## E9-S7 Hành chính ở 390 px
SPEC §5.7 (AC 1–5). Playwright: `E9-S7 Hành chính 390: menu sheet ≤ 2 chạm, không cuộn ngang mọi trang` · `E9-S7 Giao hàng 390: danh sách → chi tiết → giao tất cả → về danh sách` · `E9-S7 axe 390 các màn Hành chính`.
