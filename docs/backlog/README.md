# Backlog — VPP Công trình

Epic → story. Mỗi story có tiêu chí nghiệm thu (AC) để làm theo TDD và kiểm bằng trình duyệt. Thứ tự đề xuất: E0 → E1 → E2 → E3 → E4 → E5 → E6 → E7; E8 là giai đoạn 2.

| Epic | Tên | Phụ thuộc |
|---|---|---|
| E0 | Nền tảng: repo, compose, auth, danh bạ, nhật ký, cấu hình | — |
| E1 | Danh mục món và kho | E0 |
| E2 | Phiếu đăng ký của nhân viên | E0, E1 |
| E3 | Tổng hợp, điều chỉnh, món ngoài danh mục | E2 |
| E4 | Giao hàng và còn nợ | E3 |
| E5 | Báo cáo tháng: in và Excel | E3 |
| E6 | Chuông thông báo, lịch sử, hồ sơ, song ngữ | E2 |
| E7 | Triển khai sau EDGE và tích hợp PMH ID prod | E0 |
| E8 | Giai đoạn 2: email, phiếu giao nhận, import Excel, thống kê | E4, E5 |

Phiên bản 1.1 (2026-10-28): AC đã cập nhật theo `../review-spec.md`; mục cần chủ dự án chốt (Xuất lẻ, ảnh món ngoài danh mục) sẽ bổ sung story khi có quyết định.
