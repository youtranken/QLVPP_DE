# ADR-0006 — Frontend SPA React + Ant Design (không SSR)

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06

## Bối cảnh

Giao diện là **ứng dụng nội bộ sau đăng nhập**, tiếng Việt, cần **biểu mẫu phức tạp** (đăng ký nhiều dòng, giỏ, upload ảnh), **bảng lọc/phân trang**, **biểu đồ** thống kê, và **responsive** (dùng tốt trên điện thoại). Không có yêu cầu SEO (nội bộ, sau login).

## Quyết định

Dùng **SPA** với **React 19 + Vite + Ant Design + TanStack Query + React Router + ECharts + i18next (tiếng Việt) + Be Vietnam Pro**. Build tĩnh, phục vụ qua **nginx** (đồng thời proxy `/api`). **Không dùng SSR**.

## Hệ quả

**Tích cực:** Antd cung cấp sẵn form/table/DatePicker/responsive chất lượng cao → làm nhanh, đồng nhất; TanStack Query lo cache/đồng bộ dữ liệu; nginx phục vụ tĩnh nhẹ; cookie same-origin (BFF) không vướng CORS.
**Tiêu cực:** tải JS ban đầu lớn hơn trang SSR (chấp nhận được với mạng nội bộ); cần chú ý responsive/kích thước bundle.

## Phương án đã cân nhắc

- **SSR (Next.js/Remix):** lợi cho SEO/TTFB — **không cần** cho app nội bộ sau login, mà còn **làm phức tạp** việc giữ token/cookie trong mẫu BFF. → loại (không chọn vì phổ biến).
- **Bộ UI khác (MUI/Chakra/tự dựng):** được, nhưng Antd mạnh nhất về form+table+locale VN dày đặc dữ liệu — hợp bài toán duyệt/tổng hợp. → chọn Antd.

## Liên kết

`../architecture/SDD.md` §4, §8 · `../product/USER_STORIES.md` (NFR-1 responsive) · ADR-0002 (BFF).
