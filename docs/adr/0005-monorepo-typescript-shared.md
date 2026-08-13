# ADR-0005 — Monorepo pnpm + `packages/shared` (TypeScript cả FE và BE)

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06

## Bối cảnh

Có những **quy tắc nghiệp vụ dùng chung** giữa frontend và backend: cửa sổ đăng ký **ngày 1–10**, **kỳ theo tháng** (`periodForDate`), **giới hạn ≤ 20/món**, mã lỗi. Nếu FE và BE viết bằng hai ngôn ngữ khác nhau, các quy tắc này phải **cài đặt hai lần** → dễ lệch (FE cho phép, BE chặn hoặc ngược lại).

## Quyết định

Dùng **monorepo pnpm** với `apps/api` (NestJS), `apps/web` (React), và **`packages/shared`** (TypeScript) chứa hằng số + hàm quy tắc (`periodForDate`, `isRegistrationOpen`, `MAX_ITEM_QTY`, `ErrorCode`). Cả FE và BE **import chung** package này → **một nguồn sự thật**. Backend chọn **Node.js/TypeScript** (NestJS) để chia sẻ được code này.

## Hệ quả

**Tích cực:** quy tắc kỳ/giới hạn không bao giờ lệch giữa FE/BE; một ngôn ngữ, một toolchain; refactor xuyên FE/BE dễ.
**Tiêu cực:** ràng buộc backend phải là Node/TS (mất tự do chọn Go/.NET); cần cấu hình workspace + build thứ tự (`shared` trước).

## Phương án đã cân nhắc

- **Hai repo tách rời + backend Go/.NET:** hiệu năng runtime có thể cao hơn, nhưng **phải viết lại quy tắc ở 2 nơi** và mất chia sẻ kiểu — rủi ro lệch nghiệp vụ lớn hơn lợi ích ở quy mô này. → loại.
- **Monorepo nhưng copy quy tắc thủ công:** mất chính lợi ích của shared. → loại.

## Liên kết

`packages/shared/src/index.ts` · `../architecture/SDD.md` §4, §6 · ADR-0001.
