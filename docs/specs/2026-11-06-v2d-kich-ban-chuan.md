# Kịch bản chuẩn v2-D: một tháng chạy qua mọi trang và mọi vai

> 2026-11-06 · Chỉ là tài liệu, chưa đổi mã · Nhánh tham chiếu `feat/giao-dien-v2c`.
> **Mục đích:** cho một tháng thật với số cụ thể chạy qua mọi trang của Hành chính (HC) và của nhân viên (NV), để tìm chỗ spec còn thiếu luật, chỗ hai luật mâu thuẫn, và chỗ giao diện bắt HC phải đoán.
> **Nguồn, theo thứ tự ưu tiên:**
> 1. `2026-11-06-v2d-chot-cua-chu.md`: Đ0a–Đ36 và "Luồng chuẩn" (ràng buộc).
> 2. `2026-11-06-v2d-gop-y-hanh-chinh.md`: quy tắc R-D…, R-X….
> 3. `2026-11-06-v2d-ux-audit.md`.
> 4. `docs/prd.md` (FR-…, BR-…), `docs/architecture.md`, `docs/quyet-dinh-2026-11-05-luong-hanh-chinh.md` (Q…).
> 5. Mã định tuyến: `web/src/shell/admin-nav.ts`, `web/src/shell/app-routes.tsx`, `web/src/shell/bottom-nav.tsx`.
>
> **Cách đọc:**
> - Mỗi bước ghi: **Ai · Trang (mục menu, route)**, rồi **Thấy** (có số), **Bấm**, **Dữ liệu đổi**, **Phía kia thấy**, **Luật** và **Sổ tủ**.
> - `⚠ GAP-nn (mức)` đánh dấu chỗ không có luật, hai luật trái nhau, hoặc HC phải đoán. Mô tả đủ và đề xuất nằm ở mục **Danh sách lỗ hổng**.
> - Mức: **Cao** = sai số hàng, đặt trùng hoặc hủy nhầm của người. **Vừa** = HC phải đoán hoặc phải tự sửa tay. **Thấp** = chữ, thói quen.

---

## 0. Danh sách trang có trong app (đủ, theo mã)

**Sidebar Hành chính** (`admin-nav.ts`; nhãn lấy từ `locales/vi/nav.ts`):

| Nhóm menu | Mục | Route | Badge |
|---|---|---|---|
| Hằng tháng | Tháng này | `/admin/home` | — |
| Hằng tháng | Gửi ADM | `/admin/send-adm` | — |
| Hằng tháng | Hàng về | `/admin/arrivals` | — |
| Hằng tháng | Giao hàng | `/admin/delivery` | số người chưa nhận (R-D14.7) |
| Danh mục và tủ | Danh mục món | `/admin/catalog` | — |
| Danh mục và tủ | Tủ / Kho | `/admin/stock` (tab Tồn kho / Xuất lẻ) | số món thiếu cho người chờ (R-D15.4) |
| Danh mục và tủ | Món ngoài danh mục | `/admin/review` | số món chờ xem, chỉ kỳ đã khóa (Đ1) |
| Danh mục và tủ | Nhóm món + Đơn vị tính → **Nhóm & đơn vị** (Đ34) | `/admin/categories`, `/admin/categories/units`; `/admin/units` chuyển hướng tới đây (R-D12.7) | — |
| Quản lý | Nhân viên | `/admin/users` | — |
| Quản lý | Nhật ký | `/admin/audit` | — |
| Quản lý | Cấu hình | `/admin/config` | — |
| Xem lại sau (thu gọn) | Tổng hợp kỳ | `/admin/summary` | — |
| Xem lại sau | Báo cáo & in | `/admin/reports` | — |
| Xem lại sau | Còn nợ | `/admin/backlog` | — |
| Xem lại sau | Giao hàng (bản cũ) | `/admin/delivery/classic` | — |
| (ngoài shell) | Trang in bản chốt | `/admin/reports/snapshots/:id/print?from=send-adm\|reports` | — |

Đáy sidebar có **khung kỳ đang mở**: "Kỳ tháng N · x/N đã đăng ký · còn n ngày · khóa 00:00 ngày dd/mm".

**Nhân viên** (`app-routes.tsx`, `bottom-nav.tsx`):
- Đăng ký `/`;
- Lịch sử `/history` và chi tiết `/history/:ym` (có mục "Nhận lẻ");
- Tôi `/me`;
- chuông ở thanh trên;
- `/forbidden`.

> Kịch bản dưới đây chạm **mọi** trang trong hai bảng trên. Trang nào chỉ được nhắc qua, bảng **9. Độ phủ** ở cuối có ghi.

---

## 1. Vai diễn và trạng thái đầu

**Người**

| Mã | Tên | Vai | Ghi chú |
|---|---|---|---|
| A | Nguyễn Văn An | NV | Còn **2 Bút bi chưa nhận** của kỳ tháng 11. Đi công tác, về ngày 20/12. |
| B | Trần Thị Bình | NV | Có món ngoài danh mục. Nghỉ phép 23/12 → 12/01. |
| C | Lê Văn Cường | NV | **Nghỉ việc 15/12**: PMH ID khóa tài khoản, `users.status ≠ active`. |
| D | Phạm Thị Dung | NV | **Không đăng ký** kỳ 12. Cần giấy gấp ngày 19/12. |
| HC | Hà | Hành chính (`vpp_admin`) | Không đăng ký VPP (PRD §2). |

**Món**

| Mã tắt | Món | ĐVT | Nhóm | Tủ đầu (01/12) | Tối đa/tháng |
|---|---|---|---|---|---|
| BB | Bút bi | cây | Bút viết | **4** | 10 → hạ còn **4** ngày 04/12 |
| A4 | Giấy A4 | ram | Giấy | **0** | 10 |
| BK | Băng keo | cuộn | Kẹp & dán | **2** | 5 |
| BÌA | Bìa trình ký nhựa A4 (**ngoài danh mục**) | cái | — | không vào tủ | `default_max_qty` 20 |

**Kỳ**
- **M = kỳ tháng 12/2026.** Mở từ 00:00 11/11 và khóa 00:00 11/12 (`deadline` = 2026-12-10T17:00Z).
- **M+1 = kỳ tháng 01/2027.** Mở 00:00 11/12, khóa 00:00 11/01/2027. Đây là ca qua năm.
- Kỳ tháng 11 đã khóa từ 11/11. Từ 01/12 đến 10/12, kỳ 11 là **K\*** (tháng đang giao).
- Nợ của A (2 BB, kỳ 11): trước 11/12 là **"Chưa nhận"**; từ 00:00 11/12 thành **"Nợ tháng 11"** (Đ28, R-D14.1).

**Cấu hình đầu:** `registration_last_day = 10`, `reminder_days_left = 3`, `default_max_qty = 20`.

---

## 2. Dòng thời gian

### Giai đoạn 1: kỳ 12 đang mở, HC làm kỳ 11 (01/12 → 10/12)

#### B1 · 01/12 00:05 · Hệ thống · chuông
- **Dữ liệu đổi:**
  - chuông `period_open:2026-12-01` cho A, B, C, D (mẫu số, trừ HC): "Kỳ đăng ký tháng 12 đã mở, hạn đăng ký đến hết …";
  - HC không nhận chuông này (architecture §Lịch).
- **NV thấy:** chuông +1.
- **Luật:** FR-70.
- ⚠ **GAP-22 (Thấp):** chữ hạn ở chuông và ở đầu trang Đăng ký ("sửa được tới 23:59 ngày 10") khác câu khóa duy nhất "00:00 ngày 11/12" (R-D8.11). Danh sách chỗ phải dùng `lockPhrase` không có chuông `period_open`/`reminder` và hero nhân viên.
- **Sổ tủ:** BB 4 · A4 0 · BK 2.

#### B2 · 01/12 08:00 · HC · Tháng này `/admin/home`
- **Thấy:**
  - bộ chuyển kỳ: "kỳ đang giao: tháng 11" / "kỳ đang đăng ký: tháng 12";
  - kỳ 12: "0/4 người đã đăng ký" (R-D8.17) và danh sách chưa đăng ký A, B, C, D kèm **Chép tin nhắc** (Đ8);
  - không thấy món hay số lượng (Đ6);
  - kỳ 11 ở bước Giao, A ở tab Chưa nhận (2 BB);
  - badge Giao hàng = 1 (A);
  - Tủ/Kho: BB "Trong tủ 4 · Đang giữ 2 · Còn trống 2" (R-D15.1–R-D15.3), badge 0.
- **Bấm:** không.
- **Luật:** Đ8, Đ17, R-D8.4, R-D14.2.
- **Sổ tủ:** không đổi.

#### B3 · 02/12 08:10 · A · Đăng ký `/`
- **Thấy:**
  - dải cam (`OwedNotice`): "Bạn còn chờ nhận **Bút bi (2 cây)** từ tháng 11. Không cần đăng ký lại.";
  - tối đa BB 10.
- **Bấm:** BB 3, A4 2 → Lưu phiếu → hộp "Lưu phiếu tháng 12?" → Lưu phiếu.
- **Dữ liệu đổi:** phiếu A kỳ 12 (`created_at` 02/12 08:10) gồm BB 3, A4 2.
- **HC thấy:** khung kỳ "1/4 đã đăng ký"; A biến khỏi danh sách chưa đăng ký. **Không** thấy số món (Đ6).
- **Luật:** BR-3, BR-5, Đ8.
- **Sổ tủ:** không đổi.

#### B4 · 02/12 10:30 · B · Đăng ký `/`
- **Bấm:**
  - BB 5, A4 5, BK 2;
  - "Thêm món khác": Bìa trình ký nhựa A4, ĐVT cái, SL 2, ghi chú "màu xanh";
  - Lưu.
- **Dữ liệu đổi:**
  - phiếu B (`created_at` 10:30) có 4 dòng; dòng ngoài DM `review_status = pending`;
  - **không** sinh chuông `custom_line_new` (R-D8.5 #16).
- **B thấy:** dòng BÌA ghi "Hành chính xem từ 00:00 ngày 11/12" (R-D8.6).
- **HC thấy:** khung kỳ 2/4. Badge Món ngoài DM **không** tăng (Đ1).
- **Sổ tủ:** không đổi.

#### B5 · 03/12 14:00 · C · Đăng ký `/`
- **Bấm:** BB 2, A4 3, BK 1 → Lưu.
- **HC thấy:** 3/4; chỉ còn D chưa đăng ký.
- **Sổ tủ:** không đổi.

#### B6 · 04/12 09:00 · HC · Danh mục món `/admin/catalog` → panel phủ món Bút bi (`?item=`)
- **Thấy:**
  - thẻ BB "Tủ: 4" chữ xám (Đ33, R-D15.6);
  - panel có ô "Tối đa/tháng" = 10, không có ô "Thứ tự hiển thị" (Đ7, R-D2.1).
- **Bấm:** sửa tối đa 10 → 4 → Lưu.
- **Dữ liệu đổi:**
  - `items.max_qty = 4`;
  - audit `item.updated`;
  - dòng BB 5 của B **giữ nguyên** (BR-5: chỉ chặn khi thêm hoặc tăng).
- **B thấy (05/12):** dòng BB 5 trong giỏ, tối đa nay 4. Bấm + bị chặn (`QTY_EXCEEDS_MAX`).
- **Luật:** BR-5, FR-21.
- ⚠ **GAP-15 (Vừa):**
  - giỏ nhân viên không có luật hiển thị cho dòng **đã lưu cao hơn tối đa mới** (nhãn gì, có được lưu lại nguyên 5 không);
  - HC hạ tối đa mà không biết có bao nhiêu dòng đang vượt. Đ6 cấm lộ số kỳ mở, nên không thể báo số dòng lúc này;
  - sau khóa, Tổng hợp không có cờ "vượt tối đa".
- **Sổ tủ:** không đổi.

#### B7 · 07/12 10:00 → 08/12 08:00 · HC · Nhóm & đơn vị `/admin/categories` → panel nhóm "Kẹp & dán" (`?group=`) (Đ22, Đ34)
- **07/12, bấm:** công tắc nhóm → Ngừng → hộp "Ngừng nhóm “Kẹp & dán”? 6 món sẽ ẩn với nhân viên" (R-D12.4) → Ngừng. HC bấm nhầm nhóm.
- **Dữ liệu đổi:**
  - `item_categories.active = false`;
  - `items.active` của BK vẫn `true`; BK "Ngừng theo nhóm" (R-D12.3, R-D12.5);
  - audit `category.updated` có `affected_items`.
- **NV thấy:**
  - C mở giỏ: dòng BK 1 hiện nhãn "đã ngừng", chỉ giữ hoặc bỏ được (BR-5); C giữ;
  - A muốn thêm BK thì không thấy món trong lưới.
- **08/12 08:00, bấm:** HC bật lại nhóm → toast "6 món dùng lại; 0 món vẫn ngừng riêng". BK dùng được lại.
- **Luật:** Đ22, R-D12.3, R-D12.4, R-D12.6.
- ⚠ **GAP-21 (Thấp):** NV có dòng của món vừa bị ngừng không nhận được báo gì. Họ không biết HC có còn mua món đó không (xem thêm B31).
- **Sổ tủ:** không đổi.

#### B8 · 08/12 00:05 · Hệ thống → D · chuông nhắc; 08/12 08:30 · HC · Tháng này
- **Dữ liệu đổi:** chuông `reminder:2026-12-01` gửi **chỉ D** (days_left = 3).
- **HC thấy:** thẻ "1 người chưa đăng ký: Phạm Thị Dung"; bấm **Chép tin nhắc** rồi dán vào Zalo.
- **Nhân viên `/admin/users`:**
  - ô "Chưa đăng ký kỳ 12: 1 người";
  - cột "Kỳ tháng 12": A, B, C = Đã đăng ký; D = Chưa (R-D8.18).
- D không đăng ký.
- **Luật:** FR-70, Đ8, R-D8.18.

#### B9 · 11/12 00:00:00.300 · (biến thể) A sửa phiếu sát giờ
- A mở tab từ tối, bấm Lưu lúc 00:00:00.300 → 409 `PERIOD_LOCKED` (R-D8.13).
- A thấy "Phiếu tháng 12 đã khóa lúc 00:00. Phiếu đã lưu lúc 08:10 02/12 vẫn giữ và sẽ được giao; …".
- Phiếu kỳ 12 của A không đổi.

### Giai đoạn 2: khóa sổ kỳ 12 (11/12)

#### B10 · 11/12 00:00 · Hệ thống · khóa sổ kỳ 12
- **Dữ liệu đổi:**
  - K\* = kỳ 12; kỳ 01/2027 mở (dòng `periods` của kỳ 01 được tạo ở lần chạm đầu tiên sau mốc, `deadline` = 00:00 11/01 theo cấu hình lúc đó: 10);
  - cron 00:05: `headcount_subs(12) = {A, B, C, D}`, `headcount = 4`, `registered = 3` (R-D8.17);
  - chuông `period_locked` cho HC: "Kỳ tháng 12 đã khóa: 3/4 người đã đăng ký · 1 món ngoài danh mục chờ xem." (R-D8.5 #17);
  - 2 BB của A (kỳ 11) đổi từ "Chưa nhận" sang **"Nợ tháng 11"** (Đ28, R-D14.1). Không có job chạy; định nghĩa tính lại theo K\* lúc đọc.
- **HC thấy (08:00):**
  - badge Món ngoài DM = 1;
  - badge Giao hàng = 3 (A, B, C có dòng K\* còn lại; A còn có nợ);
  - Tủ/Kho:
    - BB: đang giữ 2 + 3 + 5 + 2 = 12, trong tủ 4 → "Thiếu 8 cho người chờ";
    - A4: đang giữ 10, tủ 0 → "Thiếu 10";
    - BK: đang giữ 3, tủ 2 → "Thiếu 1";
    - badge Tủ/Kho = 3, đỏ.
- **NV thấy:**
  - phiếu kỳ 12 chỉ đọc;
  - trang Đăng ký là kỳ 01;
  - dải cam của A nay chỉ nói kỳ 12 ("Bạn còn chờ nhận 2 món từ tháng 12"). **2 BB nợ tháng 11 không còn hiện ở trang chủ** (`previous` chỉ là tháng liền trước).
- **Luật:** Đ1, Đ6, Đ28, R-D8.1, R-D8.17, R-D14.1, R-D15.3–R-D15.4.
- ⚠ **GAP-17 (Vừa):** ngay sau khóa sổ, mọi món đều đỏ "Thiếu … cho người chờ" và badge Giao hàng đếm 3 người dù **chưa đặt và chưa có hàng**. Màu đỏ thành nhiễu, đúng cái Đ33 muốn tránh.
- ⚠ **GAP-16 (Vừa):** nhắc nợ ở trang nhân viên chỉ nhìn tháng liền trước. A không còn thấy 2 BB nợ tháng 11 dù vẫn chưa nhận.
- **Sổ tủ:** BB 4 · A4 0 · BK 2.

#### B11 · 11/12 08:30 · HC · Món ngoài danh mục `/admin/review`
- **Thấy:** 1 thẻ "Bìa trình ký nhựa A4 · 2 cái · Trần Thị Bình · màu xanh"; 3 nút "Mua lần này" · "Mua và thêm vào danh mục" · "Không mua" (R-D3.7).
- **Bấm:** Mua lần này → hộp. Chưa có bản chốt nên không có cảnh báo (R-D3.6) → xác nhận.
- **Dữ liệu đổi:**
  - dòng `accepted`;
  - chuông `line_review.accepted` cho B;
  - badge Món ngoài DM = 0.
- **B thấy:** chuông "Hành chính đã chấp nhận món "Bìa trình ký nhựa A4" (tháng 12)." Lịch sử: "Đã chấp nhận".
- **Luật:** FR-33, BR-9, R-D3.6, R-D3.7.

#### B12 · 11/12 09:00 · HC · Tổng hợp kỳ `/admin/summary` (nhóm "Xem lại sau"), xem theo món
- **Thấy:**
  - dải "Kỳ tháng 01 đang mở, xem được từ 00:00 ngày 11/01." (R-D8.10);
  - "3/4 người đã đăng ký";
  - theo món:

| Món | A | B | C | Tổng |
|---|---|---|---|---|
| BB | 3 | 5 | 2 | 10 |
| A4 | 2 | 5 | 3 | 10 |
| BK | — | 2 | 1 | 3 |
| BÌA | — | 2 | — | 2 |

  - Nợ tháng 11 (2 BB của A) **không** có trong Tổng hợp, chỉ có ở Gửi ADM và Còn nợ.
- **Luật:** Luồng chuẩn ("HC xem số tổng theo món").
- ⚠ **GAP-10 (Vừa):** Luồng chuẩn đặt việc "xem tổng theo món, giảm phiếu từng người" ngay sau chốt kỳ. Nhưng Tổng hợp kỳ nằm trong nhóm **"Xem lại sau"**, và Gửi ADM không có liên kết "ai đăng ký món này". HC phải nhớ trang ẩn. Còn nợ (nơi duy nhất Hủy nợ) và Báo cáo & in (nơi In lại) cũng nằm đó.
- ⚠ **GAP-15** (tiếp): dòng BB 5 của B vượt tối đa 4 nhưng không có nhãn nào; HC phải tự so.

#### B13 · 11/12 09:10 · HC · Tổng hợp kỳ → panel Điều chỉnh phiếu B (`?request=`)
- **Thấy:** các dòng có "−", ô số và "Bỏ"; **không có "+"**, không có "Thêm món" (Đ12, R-D6.3).
- **Bấm:**
  - BB 5 → 4;
  - khối "Vì sao giảm?" hiện ra (Đ2, R-D6.14) → chọn **Vượt định mức**, ghi thêm "Tối đa mới 4 cây/tháng";
  - Lưu.
- **Dữ liệu đổi:**
  - `request_line_adjustments` #1 (BB 5 → 4, `over_quota`, `created_at` 11/12 09:10);
  - audit `request.updated` có `adjustments`;
  - chuông `line_adjusted:B:2026-12-01:2026-12-11` (upsert, R-D6.8).
- **B thấy:**
  - chuông: "Hành chính giảm Bút bi 5 → 4 cây: Vượt định mức: Tối đa mới 4 cây/tháng";
  - Lịch sử `/history/2026-12` dòng BB: "Hành chính giảm 5 → 4 cây: Vượt định mức: Tối đa mới 4 cây/tháng · 09:10 11/12" (R-D6.11).
- **Luật:** Đ0b, Đ2, Đ12, Đ14, R-D6.1, R-D6.3, R-D6.7, R-D6.8, R-D6.11.
- **Sổ tủ:** không đổi. Đang giữ BB = 11.

### Giai đoạn 3: Gửi ADM và in trình ký (12/12)

#### B14 · 12/12 08:50 · HC · Nhóm & đơn vị → tab Đơn vị tính `/admin/categories/units`
- **Thấy:** "cuộn" thiếu tên tiếng Anh.
- **Bấm:** sửa thành "roll" → Lưu, vì phiếu ADM có cột Unit (rà soát #11, mục L.9).

#### B15 · 12/12 09:00 · HC · Gửi ADM `/admin/send-adm`, chế độ **Lập phiếu** (chưa có bản chốt có hàng, R-D5.13)
- **Thấy** (số đề nghị mặc định = đăng ký + nợ, không trừ tủ; Đ25, R-D13.2; số đậm chỉ đọc, Đ27, R-D5.14):

| Món | Đăng ký | Nợ tháng trước | Tủ hiện có (tham khảo) | Tổng cần | Đề nghị (gợi ý) | Dòng xám | Cảnh báo Đ36 (đề xuất) |
|---|---|---|---|---|---|---|---|
| BB | 9 | 2 | 4 | 11 | **11** | = 9 đăng ký + 2 nợ | Dư 4 vào kho |
| A4 | 10 | 0 | 0 | 10 | **10** | = 10 đăng ký + 0 nợ | Đủ cho người đăng ký |
| BK | 3 | 0 | 2 | 3 | **3** | = 3 đăng ký + 0 nợ | Dư 2 vào kho |
| BÌA (ngoài DM) | 2 | 0 | — | 2 | **2** | = 2 đăng ký + 0 nợ | Đủ cho người đăng ký |

- **Bấm** (Đ36a: sửa tổng tự do, không cần lý do):
  - BB → "Sửa số" → **7**: nhãn cam "Đã sửa: 7 (gợi ý 11)"; cảnh báo đổi thành **"Đủ cho người đăng ký"** (4 + 7 − 11 = 0). HC dùng 4 cây trong tủ;
  - A4 → **15**: "Đã sửa: 15 (gợi ý 10)" · **"Dư 5 vào kho"**. HC mua dư để có hàng Xuất lẻ (FR-54);
  - BK → **1**: "Đã sửa: 1 (gợi ý 3)" · **"Đủ cho người đăng ký"** (2 + 1 − 3 = 0).
- **Luật:** Đ25, Đ27, Đ36(a), R-D5.14, R-D13.1–R-D13.5.
- ⚠ **GAP-01 (Cao):** cột cảnh báo Đ36 ("đủ / thiếu n / dư n vào kho" = tủ + đề nghị − (đăng ký + nợ)) **không có trong spec**. Spec ghi nguồn là Đ0a–Đ35; R-D5.14 chỉ có dòng xám "= a đăng ký + b nợ". Bảng **Cảnh báo lệch số** ở mục 6 đưa ra chữ và điều kiện.
- ⚠ **GAP-18 (Vừa):** cột "Đăng ký" thật ra là `requested` = **phần chưa giao** của kỳ, không phải số đăng ký (architecture §10). Ở đây hai số bằng nhau vì chưa giao gì. Ở B33 hai số lệch nhau.

#### B16 · 12/12 09:02 · HC · Gửi ADM → **In trình ký**
- **Bấm:**
  - In trình ký → `POST …/snapshots {kind:'print', order_qty:{BB:7, A4:15, BK:1, BÌA:2}, reuse_if_unchanged:true}` → **201**, bản chốt **S1** lúc 09:02 12/12 → hộp in mở (Đ5, R-D5.1–R-D5.5);
  - HC bấm Hủy trong hộp in (máy in chưa bật), bật máy in, bấm lại In trình ký → **200 `reused`**, vẫn S1 (Đ15, R-D5.9) → in → ký;
  - trang chuyển sang chế độ **Đã gửi**: băng xanh "Đã gửi ADM lúc 09:02 12/12 · 4 món, 25 đơn vị" (R-D5.13);
  - **Xuất Excel bản này** → tải file của S1, không tạo bản mới (R-D5.8). HC gửi file cho ADM.
- **Dữ liệu đổi:**
  - `report_snapshots` thêm 1 dòng (S1);
  - audit `report.snapshot`;
  - Tháng này: bước Gửi ADM "Đã gửi 09:02 12/12 · 4 món, 25 đơn vị" (R-D5.18);
  - Hàng về lấy S1 làm nguồn (R-D11.6).
- **NV thấy:** không có gì.
- **Luật:** Đ5, Đ15, Đ29, Đ30, R-D5.1–R-D5.18.
- ⚠ **GAP-23 (Thấp):** "Đã gửi" bật ngay khi bản chốt được tạo, kể cả khi HC hủy hộp in và chưa bao giờ gửi. App không phân biệt "đã chốt" với "đã gửi ADM".
- **Sổ tủ:** BB 4 · A4 0 · BK 2.

#### B17 · 13/12 10:00 · HC · Tổng hợp kỳ → panel phiếu B · **giảm sau khi đã gửi ADM** (Đ11)
- **Bối cảnh:** B nhắn "chỉ cần 3 ram, dự án đã cấp giấy".
- **Bấm:** A4 5 → 3 → lý do **Khác**, ghi "Dự án đã cấp giấy" → Lưu.
- **Dữ liệu đổi:**
  - adjustment #2 (`created_at` 13/12 10:00 > S1) = "giảm sau khi gửi ADM" (R-D6.17);
  - chuông mới cho B (ngày khác, Đ14).
- **HC thấy:**
  - Gửi ADM (chế độ Đã gửi): "Có thay đổi sau bản chốt 09:02 — in lại nếu cần" (R-X.1). HC **không** in lại vì ADM đã nhận bản S1;
  - Hàng về A4: nhãn "Đã giảm 2 sau khi gửi ADM — phần dư vào tủ" (R-D11.9).
- **B thấy:** chuông "Hành chính giảm Giấy A4 5 → 3 ram: Dự án đã cấp giấy"; Lịch sử thêm dòng.
- **Luật:** Đ11, Đ36(b), R-D6.17, R-X.1, R-D11.9.
- ⚠ **GAP-01** (tiếp): trong panel giảm **không có** cảnh báo trước khi Lưu ("đã gửi ADM, giảm thì hàng về dư 2 vào kho"). Đ36 yêu cầu cảnh báo ở Tổng hợp. Spec chỉ cảnh báo **sau** khi lưu, và ở trang khác (Gửi ADM, Hàng về).
- ⚠ **GAP-01** (tiếp): ở chế độ Đã gửi, bảng đóng băng theo S1, nên HC không thấy từng món đang dư bao nhiêu so với nhu cầu sống. Chỉ có một câu chung.

### Giai đoạn 4: người nghỉ việc, đổi cấu hình (15/12)

#### B18 · 15/12 · PMH ID khóa tài khoản C (webhook `user.*`) · HC · Nhân viên `/admin/users`
- **Dữ liệu đổi:**
  - `users.status(C) ≠ active`; phiên của C bị hủy (PRD tiêu chí 7);
  - phiếu C kỳ 12 vẫn còn BB 2, A4 3, BK 1.
- **HC thấy:** **không có gì ở Tháng này hay Giao hàng**. Chỉ trang Nhân viên ghi C "Đã nghỉ". Hộp giao của C (nếu mở) ghi "Người đã nghỉ — giao chỉ khi có người nhận thay", mọi dòng đề xuất 0 (R-D7.12).
- ⚠ **GAP-06 (Vừa):** không có cảnh báo "người đã nghỉ còn hàng chờ". Nếu HC không để ý:
  - 6 đơn vị của C nằm "Chưa nhận" tới 11/01;
  - sau đó thành **nợ** và được cộng vào đề nghị kỳ 01 theo mặc định Đ25, tức là **mua hàng cho người đã nghỉ**.

#### B19 · 15/12 09:30 · HC · Tổng hợp kỳ → panel phiếu C (Đ26, Đ18)
- **Bấm:**
  - BB 2 → 0, A4 3 → 0, BK 1 → 0;
  - lý do **Người đã nghỉ** cho dòng đầu → "Dùng cho các món giảm còn lại" (R-D6.14);
  - không cần ghi chú;
  - Lưu.
- **Dữ liệu đổi:**
  - adjustments #3–#5 (`user_left`, sau S1);
  - **không chuông** (Đ14, Đ26, R-D6.8);
  - phiếu C được giữ với 0 dòng, vẫn tính đã đăng ký (Đ18, R-D6.16): Tổng hợp vẫn "3/4", theo người ghi "0 món — Hành chính đã bỏ toàn bộ".
- **HC thấy:**
  - Giao hàng: C biến khỏi lưới; badge Giao hàng = 2 (A, B);
  - Hàng về: BB "Đã giảm 2 sau khi gửi ADM"; A4 "Đã giảm 5" (2 của B + 3 của C); BK "Đã giảm 1"; đầu trang "3 món đã giảm sau khi gửi ADM — phần dư sẽ vào tủ".
- **NV thấy:** C không đăng nhập được. Lịch sử của C (nếu có người xem hộ) ghi "Hành chính đã bỏ toàn bộ: Người đã nghỉ".
- **Nhu cầu sống sau bước:** BB 3 (A) + 4 (B) + 2 (nợ A) = **9** · A4 2 + 3 = **5** · BK **2** (B) · BÌA 2.

#### B20 · 15/12 10:00 · HC · Cấu hình `/admin/config`
- **Bấm:** "Ngày hạn đăng ký" 10 → **8**. HC muốn kỳ 01 khóa sớm vì Tết. UI ghi "kỳ đang mở giữ hạn cũ" (FR-82) → Lưu.
- **Dữ liệu đổi:** `config.registration_last_day = 8`; audit `config.updated`.
- **Thực tế:** kỳ 01 đã có dòng `periods` từ 11/12 với `deadline` 00:00 11/01 (BR-2), nên **kỳ 01 vẫn khóa 11/01**. Ngày 8 chỉ áp từ kỳ 02/2027 (khóa 00:00 09/02).
- **NV thấy:** khung kỳ và chuông vẫn nói hạn kỳ 01 là ngày 10.
- ⚠ **GAP-14 (Vừa):** HC nghĩ "kỳ đang mở" là kỳ 12 vì đang làm kỳ 12. Thật ra kỳ đang mở là kỳ 01, đã tạo từ hôm 11/12. UI không nói thay đổi áp **từ kỳ nào, khóa ngày nào**.

### Giai đoạn 5: hàng về đợt 1 thiếu, ADM hết Băng keo (18/12)

#### B21 · 18/12 09:00 · HC · Hàng về `/admin/arrivals` (đợt 1)
- **Hàng thật:**
  - ADM giao BB **3** (bản in 7), A4 **15**, Bìa trình ký 2 cái;
  - ADM báo **hết Băng keo**.
- **Thấy** ("Theo bản in 09:02 12/12", R-D11.6; điền sẵn = còn lại, R-D11.7):

| Nhóm / Món | Đề nghị | Đã về các đợt trước | Tủ hiện có | Về đợt này (điền sẵn) | Nhãn |
|---|---|---|---|---|---|
| Bút viết / BB | 7 | 0 | 4 | 7 | Đã giảm 2 sau khi gửi ADM — phần dư vào tủ |
| Giấy / A4 | 15 | 0 | 0 | 15 | Đã giảm 5 sau khi gửi ADM — phần dư vào tủ |
| Kẹp & dán / BK | 1 | 0 | 2 | 1 | Đã giảm 1 sau khi gửi ADM — phần dư vào tủ |
| Khối thu gọn "Món ngoài danh mục — giao thẳng, không vào tủ (1)" | BÌA 2 | — | — | (chỉ đọc) | — |

- **Bấm:**
  - BK → nút **ADM hết hàng** → `PUT /admin/periods/2026-12/adm-out/BK`. B còn dòng mở nên được phép. Ô về thành 0 và khóa, nhãn xám "ADM hết hàng" (Đ19, R-D11.12);
  - BB: sửa 7 → **3** → Tình trạng "Thiếu 4" (R-D13.7);
  - A4 giữ 15 → "Đủ";
  - ghi chú "Phiếu giao ADM số 18/12" → **Lưu hàng về**.
- **Dữ liệu đổi:**
  - `stock_movements` purchase BB +3, A4 +15 (`receipt_ym = 2026-12`, R-D11.8);
  - `period_adm_out(2026-12, BK)`;
  - Nhật ký 1 dòng gộp "Nhập hàng về kỳ tháng 12 — 2 món, 18 đơn vị" (R-D16.3) + `arrival.adm_out_marked`;
  - Tháng này bước Hàng về: còn lại 4 (BB), chưa xong (R-D11.17).
- **HC thấy:**
  - Tủ/Kho BB: trong tủ 7, đang giữ 9 → "Thiếu 2 cho người chờ";
  - A4: tủ 15, giữ 5, còn trống 10;
  - BK: tủ 2, giữ 2, "Sắp hết" hoặc "Còn 0".
- **Luật:** Đ16, Đ19, Đ23, Đ24, Đ36 (Hàng về: về khác bản in), R-D11.2–R-D11.13, R-D13.7.
- ⚠ **GAP-01** (tiếp): nhãn "Thiếu 4" chỉ là Tình trạng của dòng. Không có cảnh báo cấp đợt trước khi Lưu ("Đợt này khác bản in ở 1 món: Bút bi về 3/7").
- ⚠ **GAP-12 (Vừa):** món ngoài DM đã về (2 Bìa) **không ghi được ở đâu**. Khối chỉ đọc, "ADM hết hàng" không áp cho món ngoài DM (R-D11.13), và hộp giao không có trần theo hàng thật. HC giao được Bìa cả khi ADM chưa giao.
- **Sổ tủ:** **BB 7 · A4 15 · BK 2**.

### Giai đoạn 6: xuất lẻ và giao thiếu (19/12 → 20/12)

#### B22 · 19/12 09:00 · HC · Tủ / Kho `/admin/stock` → tab **Xuất lẻ** → "Xuất lẻ một món" (R-D15.5)
- **Bấm:**
  - món Giấy A4, SL 1, người nhận **Phạm Thị Dung**;
  - lý do "Chưa đăng ký kỳ 12, cần in hồ sơ thầu" → Xuất lẻ.
- **Dữ liệu đổi:**
  - `stock_movements` issue −1 (`recipient_sub = D`);
  - audit;
  - A4: tủ 15 → **14**; đang giữ 5, còn trống 9.
- **D thấy:** Lịch sử → mục **"Nhận lẻ"**: "Giấy A4 · 1 ram · 19/12". **Không có chuông.**
- **Luật:** Đ9 (bỏ tạo phiếu hộ, cần gấp thì Xuất lẻ), FR-54, BR-7.
- ⚠ **GAP-09 (Vừa):** Xuất lẻ **không** xét hàng đang giữ cho người chờ. Ví dụ cùng ngày HC xuất 2 BB cho phòng họp: tủ 7 → 5 trong khi đang giữ 9. Người chờ thiếu thêm 2, kể cả sau đợt 2. App không cảnh báo, vì đợt 2 chỉ còn 4 theo bản in.
- ⚠ **GAP-20 (Thấp):** người nhận lẻ không có chuông.
- **Sổ tủ:** BB 7 · **A4 14** · BK 2.

#### B23 · 19/12 14:00 · HC · Giao hàng `/admin/delivery`, thẻ B → "Giao…" (Đ3)
- **Thấy:**
  - tab Chưa nhận 2 (A, B); tab Còn nợ 1 (A); ghi chú "1 người có cả hai" (R-D14.2);
  - thẻ B: "4 món · 11 đơn vị" (R-D7.13);
  - hộp "Giao cho Trần Thị Bình?":

| Món | Cần giao | Giao lần này (đề xuất) | Còn lại sau lần này | Ghi chú dòng |
|---|---|---|---|---|
| BB | 4 | **2** | Chưa nhận 2 | "Cần 4 · Tủ 7 · 1 người khác còn chờ 5" · "Giữ 5 cho 1 người đăng ký trước" (R-D7.9: A nợ tháng 11 = 2, rồi A kỳ 12 = 3) |
| A4 | 3 | 3 | — | "Cần 3 · Tủ 14 · 1 người khác còn chờ 2" |
| BÌA (ngoài DM) | 2 | 2 | — | không trừ tủ (FR-41) |
| Nhóm **"ADM hết hàng — hủy, không thành nợ"**: BK | 2 | **0** (mặc định, Đ16) | sẽ hủy 2 | "Cần 2 · Tủ 2" |

  - dòng tổng: "Giao 7 · còn 2 chưa nhận" + "Hủy 1 món ADM hết hàng" (R-D7.3);
  - ghi chú "Bấm Xác nhận là không sửa được…" (R-D7.11).
- **Bấm:** HC để theo mặc định → **Xác nhận giao**.
- **Dữ liệu đổi:**
  - giao BB 2, A4 3, BÌA 2;
  - `cancel-remaining {reason_code:'adm_out_of_stock'}` cho BK 2 (R-D11.13);
  - tủ BB 7 → 5, A4 14 → 11, BK **vẫn 2**.
- **B thấy:**
  - chuông "Băng keo (2 cuộn) không giao được: ADM hết hàng. Tháng sau cần thì đăng ký lại.";
  - Lịch sử kỳ 12:
    - BB "Nhận 2, chờ 2" (kèm dòng giảm 5 → 4);
    - A4 "Đã nhận đủ" (kèm 5 → 3);
    - BK "Đã hủy 2 — ADM hết hàng";
    - BÌA "Đã nhận đủ".
  - Không có chuông "giao đủ".
- **HC thấy:** toast "Đã giao cho Trần Thị Bình" + "Người tiếp theo"; focus về ô tìm (R-D7.6).
- **Luật:** Đ3, Đ13, Đ16, Đ19, Đ25 ("giao vẫn lấy từ tủ"), Đ28, R-D7.1–R-D7.13, R-D11.13.
- ⚠ **GAP-02 (Cao):** Đ16 ("dòng ADM hết hàng mặc định 0 và hủy luôn") **trái** với cách HC đã tính ở Gửi ADM (Đ36a: "giảm → dùng hàng tủ"). HC chỉ đặt BK 1 vì tủ có 2 đủ cho B. ADM hết thì 2 cuộn trong tủ vẫn đủ cho B, nhưng app mặc định hủy hết. B mất 2 cuộn, tủ dư 2 cuộn không ai nhận. HC muốn đúng thì phải tự nhớ nâng stepper.
- ⚠ **GAP-01** (tiếp): Đ36 "Giao hàng: tủ không đủ cho người đang chờ". Dòng BB chỉ có chữ thông tin (R-D7.13), không có cảnh báo rõ "Tủ 7 không đủ cho 2 người đang chờ 9 — thiếu 2".
- ⚠ **GAP-12** (tiếp): trần stepper của dòng ngoài DM không được định nghĩa (R-D7.3 dùng `min(còn nợ, tủ)` mà món ngoài DM không có tủ).
- **Sổ tủ:** **BB 5 · A4 11 · BK 2**.

#### B24 · 20/12 08:30 · HC · Danh mục món → panel Băng keo → công tắc **Ngừng** (ADM báo nhà cung cấp bỏ mã)
- **Dữ liệu đổi:** `items.active(BK) = false` ("Ngừng riêng"); audit.
- **Ảnh hưởng:**
  - A đã lưu BK 1 vào phiếu kỳ 01 hôm 18/12 (xem B29). Dòng đó **giữ nguyên**; A không được báo;
  - HC không thấy dòng này vì kỳ 01 đang mở (Đ6);
  - Tủ/Kho BK "Ngừng riêng", tủ 2.
- **Luật:** Đ22, R-D12.5, R-D12.6, BR-5.
- ⚠ **GAP-05 (Vừa):** đến lúc khóa kỳ 01, Gửi ADM sẽ mặc định **đề nghị cả món đã ngừng**. Nếu ADM vẫn giao thì Hàng về **từ chối nhập** (R-D11.10: "Đã ngừng — bật lại ở Nhóm món để nhập"). Hai luật kéo hai hướng.

#### B25 · 20/12 10:00 · HC · Giao hàng → thẻ A → "Giao…"
- **Thấy:**

| Món | Cần giao | Giao lần này | Còn lại sau |
|---|---|---|---|
| BB "Nợ tháng 11" | 2 | 2 | 0 |
| BB (tháng 12) | 3 | 3 (= min(3, 5 − 2)) | 0 |
| A4 | 2 | 2 | 0 |

  - dòng tổng: "Giao đủ 7".
- **Bấm:** Xác nhận giao.
- **Dữ liệu đổi:** BB 5 → **0**, A4 11 → **9**.
- **A thấy:** 2 chuông "Phiếu tháng 11 của bạn đã được giao đủ." và "Phiếu tháng 12 của bạn đã được giao đủ." (FR-43).
- **HC thấy:**
  - badge Giao hàng = 1 (B, Chưa nhận BB 2);
  - Tủ/Kho BB: trong tủ 0, đang giữ 2 → "Thiếu 2 cho người chờ"; badge Tủ/Kho = 1.
- **Luật:** R-D7.9 (kỳ cũ trước), R-D7.10, FR-43.
- **Sổ tủ:** **BB 0 · A4 9 · BK 2**.

### Giai đoạn 7: hàng về đợt 2 "Đủ hàng", kiểm kê (22/12 → 28/12)

#### B26 · 22/12 10:15 · HC · Hàng về → **Đủ hàng** (Đ24)
- **Hàng thật:** ADM giao bù BB 4.
- **Bấm:** "Đủ hàng" → hộp xác nhận (R-D11.14):
  - "Nhập 1 món, 4 đơn vị vào tủ theo bản in 09:02 12/12.";
  - "1 món ADM hết hàng · 1 món ngoài danh mục (giao thẳng) · 1 món đã về đủ";
  - "3 món đã giảm sau khi gửi ADM — phần dư sẽ vào tủ";
  - → Xác nhận.
- **Dữ liệu đổi:**
  - purchase BB +4 → tủ BB **4**;
  - toast "Đã nhập 1 món vào tủ";
  - trang thành khối xong: "Hàng kỳ tháng 12 đã về đủ — 2 món, 22 đơn vị (nhập lần cuối 10:15 22/12)." + "Sang Giao hàng →" + danh sách 2 đợt (R-D11.18);
  - Tháng này: bước Hàng về xong (R-D11.17).
- **HC thấy (Tủ/Kho):** BB trong tủ 4, đang giữ 2 (B), còn trống 2 → "Còn 2"; badge Tủ/Kho = 0.
- **B** đang nghỉ phép nên không đến lấy.
- **Luật:** Đ24, R-D11.14–R-D11.18.
- **Sổ tủ:** **BB 4 · A4 9 · BK 2**.

#### B27 · 28/12 15:00 · HC · Tủ / Kho → dòng ⋯ → **Kiểm kê**
- **BB:** đếm được 4 = tồn → app "Số đếm khớp tồn hiện tại — không cần lưu." Không có bản ghi nào.
- **A4:** đếm 9 = 9, tương tự.
- **BK:** đếm **1** (tồn 2) → ghi chú "Kiểm cuối tháng: thiếu 1 cuộn" → Lưu → `POST …/stock/count {counted_qty:1, expected_stock_qty:2}` → delta −1, sổ cái `adjust`, audit `stock.adjust`.
- **Luật:** FR-52, architecture `stock/count`.
- ⚠ **GAP-19 (Thấp):** kiểm kê khớp số không ghi được gì (400 `VALIDATION`), nên không có bằng chứng đã kiểm món đó.
- ⚠ **GAP-09** (tiếp): kiểm kê làm tủ < đang giữ thì không có cảnh báo cho người đang chờ.
- **Sổ tủ:** **BB 4 · A4 9 · BK 1**.

#### B28 · 28/12 15:20 · HC · Còn nợ `/admin/backlog` (nhóm "Xem lại sau")
- **Thấy:** trang Còn nợ **trống**. 2 BB của B là "Chưa nhận" của K\* = 12, không phải nợ (Đ28, R-D14.3).
- **Thử:** HC tìm cách hủy 2 BB vì B nghỉ phép lâu. Ở Giao hàng → panel B không có Hủy nợ. Gọi `cancel-remaining` → 409 `NOT_DEBT_YET`: "Đây là phần chưa nhận của tháng đang giao — giảm ở Tổng hợp nếu không giao nữa." (R-D14.4). HC để nguyên.
- **Luật:** Đ28, R-D14.3, R-D14.4.

### Giai đoạn 8: kỳ 01 đăng ký, khóa sổ (18/12 → 11/01)

#### B29 · Kỳ 01 đăng ký (mở từ 11/12)
- **18/12, A:** BB 4 (tối đa 4), BK 1. BK còn dùng được lúc lưu.
- **05/01, B** (đăng ký từ xa trong lúc nghỉ phép): A4 2.
  - Dải cam: "Bạn còn chờ nhận **Bút bi (2 cây)** từ tháng 12. Không cần đăng ký lại." (`OwedNotice`, `previous` = kỳ 12).
- **08/01, D:** A4 2.
- C không vào được.
- **HC thấy:**
  - khung kỳ kỳ 01: từ 15/12 mẫu số sống còn 3 (C đã nghỉ, chưa có phiếu kỳ 01, nên không thuộc S);
  - 08/01: "3/3 người đã đăng ký".
- ⚠ **GAP-21** (tiếp): A lưu BK 1 hôm 18/12. Món ngừng hôm 20/12 nhưng giỏ của A không nói gì.

#### B30 · 11/01/2027 00:00 · khóa sổ kỳ 01 (không phải 09/01 như HC tưởng ở B20)
- **Dữ liệu đổi:**
  - K\* = kỳ 01;
  - `headcount_subs(01) = {A, B, D}`, 3/3;
  - chuông `period_locked` cho HC: "Kỳ tháng 01 đã khóa: 3/3 người đã đăng ký.";
  - **2 BB "Chưa nhận" kỳ 12 của B thành "Nợ tháng 12"** (Đ28, R-D14.1).
- **HC thấy:**
  - Giao hàng: B ở cả tab Chưa nhận (A4 kỳ 01) và tab Còn nợ (BB tháng 12); thẻ B có nhãn phụ "Nợ tháng 12";
  - trang Còn nợ: 1 dòng "Bút bi · 2 cây · Trần Thị Bình · tháng 12 · Tủ còn 4".
- **B thấy:** Lịch sử kỳ 12 vẫn "Nhận 2, chờ 2".
- **Luật:** Đ28, R-D8.17, R-D14.1–R-D14.3.
- ⚠ **GAP-03 (Cao) — biến thể:** giả sử hôm 19/12 B **không** đến lấy. Khi đó dòng BK 2 của B (món đã đánh ADM hết hàng) chưa bị hủy, vì Đ16 chỉ hủy **trong hộp giao**. Lúc 00:00 11/01 dòng đó thành "Nợ tháng 12" và **được cộng vào đề nghị kỳ 01** (Đ25). Kết quả trái Đ16 ("không thành nợ").
- ⚠ **GAP-04 (Cao) — biến thể:** giả sử ADM giao đợt 2 (4 BB) **sau** 11/01. Hàng về chỉ mở kỳ khóa mới nhất (`arrivals-page.tsx:205-210`). R-D8.10 không nói có chọn được kỳ 12 không. Đồng thời 2 BB của B đã thành nợ và được đề nghị lại ở kỳ 01. Hệ quả: hàng đặt **hai lần**, và đợt bù kỳ 12 không có chỗ ghi đúng kỳ.

#### B31 · 12/01 09:10 · HC · Gửi ADM kỳ 01 (Lập phiếu)
- **Thấy:**

| Món | Đăng ký | Nợ tháng trước | Tủ | Đề nghị gợi ý | Cảnh báo Đ36 (đề xuất) | HC sửa → cảnh báo |
|---|---|---|---|---|---|---|
| BB | 4 (A) | 2 (B, tháng 12) | 4 | 6 | Dư 4 vào kho | **2** → Đủ cho người đăng ký |
| A4 | 4 (B 2 + D 2) | 0 | 9 | 4 | Dư 9 vào kho | **0** → vẫn "Dư 5 vào kho" (tủ một mình đã dư) |
| BK (**đã ngừng**) | 1 (A) | 0 | 1 | 1 | Dư 1 vào kho | **0** → Đủ (tủ 1 giao cho A) |

- **Bấm:** In trình ký → bản chốt **S2** 09:10 12/01: 1 món, 2 đơn vị (BB 2).
- **Luật:** Đ25, Đ27, Đ36, R-D6.21.
- ⚠ **GAP-05** (tiếp): dòng BK không có nhãn "Đã ngừng" và không có luật số mặc định cho món đã ngừng.
- ⚠ **GAP-24 (Thấp):** spec không nói dòng **Đề nghị 0** (A4, BK) có in ra phiếu ADM hay bỏ khỏi phiếu.
- ⚠ **GAP-08 (Vừa) — biến thể:** nếu A chỉ đăng ký 2 BB, mọi dòng về 0 khi trừ tủ. Đ30 chặn in ("Chưa có món nào để đề nghị"), nên:
  - bước Gửi ADM ở Tháng này **không bao giờ xong**;
  - Hàng về không có bản chốt, rơi về số gộp (R-D11.7) và **điền sẵn hàng chờ nhập** dù không đặt gì;
  - "Đủ hàng" tắt với lý do sai ("Chưa in trình ký gửi ADM").
- **Sổ tủ:** không đổi.

#### B32 · 13/01 08:30 · HC · Còn nợ → dòng BB của B → ⋯ → **Hủy nợ** (R-D14.6)
- **Bối cảnh:** B đi làm lại, nói không cần 2 bút nữa.
- **Thấy:** hộp "Hủy nợ 2 cây Bút bi của Trần Thị Bình?" với 4 lý do; dòng "Nhân viên sẽ thấy lý do trong Lịch sử."; nút [Quay lại] [Hủy nợ].
- **Bấm:** **Người nhận không cần nữa** → Hủy nợ.
- **Dữ liệu đổi:**
  - `cancelled_qty` +2, `cancel_reason = "Người nhận không cần nữa"`;
  - audit có `reason_code`;
  - chuông `line_cancelled` cho B.
- **B thấy:**
  - chuông "Hành chính hủy phần còn nợ 2 cây Bút bi (tháng 12): Người nhận không cần nữa";
  - Lịch sử kỳ 12 BB: "Nhận 2 · đã hủy 2 — Người nhận không cần nữa";
  - dải cam ở trang Đăng ký biến mất.
- **HC thấy:**
  - Gửi ADM kỳ 01 (Đã gửi S2): **không có cảnh báo**, vì R-X.1 chỉ xét bản ghi điều chỉnh và `requests.updated_at`;
  - nhu cầu BB nay là 4, tủ 4 + đề nghị 2 → **dư 2**.
- **Luật:** FR-35, R-D14.4–R-D14.6.
- ⚠ **GAP-07 (Vừa):** Hủy nợ (và "Không mua" món ngoài DM) **sau** khi in làm dư hàng nhưng không có cảnh báo Đ11/Đ36 nào.
- **Sổ tủ:** **BB 4 · A4 9 · BK 1**.

### Giai đoạn 9: báo cáo, in lại, nhật ký (14/01)

#### B33 · 14/01 09:00 · HC · Báo cáo & in `/admin/reports?ym=2026-12` (nhóm "Xem lại sau")
- **Thấy:**
  - phần 1 (tổng theo món) **trống**. Kỳ 12 không còn dòng nào chưa giao, và báo cáo chỉ lấy hàng có `requested + backlog_prev > 0` (architecture §10);
  - phần 2 (theo phòng ban → người): A (BB 3, A4 2), B (BB 4, A4 3, BK 2, BÌA 2), C (0 dòng, không hiện, R-D6.16);
  - danh sách Bản chốt: S1 09:02 12/12 (4 món, 25 đơn vị).
- **Bấm:**
  - **In lại** S1 → `/admin/reports/snapshots/<S1>/print?from=reports`, cùng tab, không tự in (R-D5.6);
  - tờ A4 đóng băng: BB 7, A4 15, BK 1, BÌA 2, 3 ô ký (Đ5, Đ15, Đ32);
  - In → Quay lại về Báo cáo.
- **Luật:** Đ5, Đ32, R-D5.6, R-D5.15, R-D5.16.
- ⚠ **GAP-18** (tiếp): cột "Đăng ký" của Báo cáo và Gửi ADM thực ra là **phần chưa giao**. Báo cáo một tháng đã xong thì phần 1 rỗng, và HC không trả lời được câu "tháng 12 xin ADM bao nhiêu, về bao nhiêu" nếu không mở bản in.

#### B34 · 14/01 09:20 · HC · Nhật ký `/admin/audit`, chip "Việc của Hành chính"
- **Thấy** (gom theo R-D16.3; vai admin thấy `request.*` của kỳ đã khóa):
  - `item.updated` BB tối đa 10 → 4 (04/12);
  - `category.updated` ngừng / bật "Kẹp & dán" (07/12, 08/12);
  - `line.review` Bìa chấp nhận (11/12);
  - `request.updated` B giảm (11/12, 13/12); C bỏ toàn bộ (15/12);
  - `report.snapshot` S1; `config.updated` ngày hạn 8;
  - "Nhập hàng về kỳ tháng 12 — 2 món, 18 đơn vị"; `arrival.adm_out_marked` BK;
  - `stock.issue` A4 → D; các lần giao; `line.cancel` BK (ADM hết hàng); "Nhập hàng về … 1 món, 4 đơn vị";
  - `item.updated` ngừng BK; `stock.adjust` BK −1;
  - `report.snapshot` S2; `line.cancel` BB của B.
- Các lần NV lưu phiếu kỳ 01 trước 11/01 bị ẩn với admin cho tới khi khóa (R-D8.14).

---

## 3. Sổ tủ chạy theo từng bước

Công thức kiểm: **tủ đầu + nhập − giao − xuất lẻ ± kiểm kê = tủ cuối**. Món ngoài DM không vào tủ (R-D11.11).

| Bước | Ngày | Sự kiện | BB | A4 | BK |
|---|---|---|---|---|---|
| Đầu | 01/12 | trạng thái đầu | 4 | 0 | 2 |
| B1–B20 | 01/12–15/12 | đăng ký, khóa, giảm, in, đổi cấu hình | 4 | 0 | 2 |
| B21 | 18/12 | Hàng về đợt 1: BB +3, A4 +15, BK ADM hết hàng | 7 | 15 | 2 |
| B22 | 19/12 | Xuất lẻ A4 −1 cho D | 7 | 14 | 2 |
| B23 | 19/12 | Giao B: BB −2, A4 −3 (BÌA 2 giao thẳng; BK hủy 2) | 5 | 11 | 2 |
| B25 | 20/12 | Giao A: BB −2 (nợ tháng 11) −3, A4 −2 | 0 | 9 | 2 |
| B26 | 22/12 | Đủ hàng: BB +4 | 4 | 9 | 2 |
| B27 | 28/12 | Kiểm kê BK −1 | 4 | 9 | 1 |
| B29–B34 | → 14/01 | đăng ký kỳ 01, in S2, Hủy nợ (không đổi tủ) | 4 | 9 | 1 |

**Kiểm cân:**
- BB: 4 + (3 + 4) − (2 + 2 + 3) − 0 ± 0 = **4** ✓
- A4: 0 + 15 − (3 + 2) − 1 ± 0 = **9** ✓
- BK: 2 + 0 − 0 − 0 − 1 = **1** ✓

---

## 4. Đối chiếu số kỳ 12: "đăng ký + nợ" → "đề nghị" → "về" → "giao"

| Món | Đăng ký gốc + nợ | Giảm (lý do) | Còn hiệu lực | Đề nghị (S1) | Về | Giao | Hủy | Tủ cuối do kỳ này để lại |
|---|---|---|---|---|---|---|---|---|
| BB | 10 + 2 nợ (A) = 12 | B −1 (vượt định mức), C −2 (đã nghỉ) | 9 | 7 (= 11 − 4 tủ) | 7 (3 + 4) | 7 (A 2 nợ + 3, B 2) | B 2 (Hủy nợ 13/01) | 4 |
| A4 | 10 | B −2 (khác), C −3 (đã nghỉ) | 5 | 15 (+5 dư chủ ý) | 15 | 5 | 0 | 9 (sau Xuất lẻ 1 cho D) |
| BK | 3 | C −1 (đã nghỉ) | 2 | 1 (= 3 − 2 tủ) | 0 (ADM hết) | 0 | B 2 (ADM hết hàng) | 1 (sau kiểm kê −1) |
| BÌA (ngoài DM) | 2 | — | 2 | 2 | 2 (không ghi trong app) | 2 | 0 | — |

**Phần dư, phần thiếu đi đâu:**
- **BB, tủ cuối 4:**
  - 4 cây tủ đầu kỳ đã được tính vào đề nghị (đặt 7 thay 11);
  - sau đó C nghỉ (−2) và B hủy nợ (−2), nên còn đúng 4 = 2 (C) + 2 (B).
  - Không có cảnh báo nào cho phần 2 cây của B (GAP-07). Phần 2 cây của C có nhãn R-D11.9.
- **A4, tủ cuối 9:** dư chủ ý 5 + B giảm sau gửi 2 + C nghỉ 3 − Xuất lẻ cho D 1 = 9.
  - Kỳ 01 cần 4 nên tủ vẫn dư 5. Gửi ADM đặt 0 mà vẫn "Dư 5 vào kho" (B31).
- **BK, tủ cuối 1:**
  - đề nghị 1 dựa trên tủ 2. ADM hết hàng, và Đ16 mặc định hủy hết phần của B dù tủ đủ (GAP-02), nên 2 cuộn nằm lại tủ;
  - kiểm kê mất 1; kỳ 01 dùng 1 còn lại cho A (món đã ngừng).
  - **Đây là chỗ số không khớp ý định của HC.**
- **BÌA:** về và giao đều ngoài sổ. App không chứng minh được ADM đã giao (GAP-12).
- **Kỳ 01, BB:** đề nghị 2 + tủ 4 = 6 cho nhu cầu 6 (A 4 + nợ B 2). B hủy nợ sau khi in → dư 2, không có cảnh báo (GAP-07).

---

## 5. Danh sách lỗ hổng

Sắp theo mức, rồi theo thứ tự xuất hiện trong kịch bản.

### Cao

**GAP-01 — Đ36 (cảnh báo lệch số) chưa có trong spec.** (B15, B17, B21, B23)
- **Thiếu gì:** spec ghi nguồn Đ0a–Đ35. Không có quy tắc R nào cho:
  - dòng "đủ / thiếu n / dư n vào kho" ở Gửi ADM;
  - cảnh báo trong panel giảm khi phiếu đã gửi ADM (chỉ có cảnh báo sau, ở trang khác);
  - cảnh báo cấp đợt "về khác bản in" ở Hàng về;
  - cảnh báo "tủ không đủ cho người đang chờ" ở Giao hàng;
  - chế độ Đã gửi chỉ có câu chung R-X.1, không có lệch số theo từng món.
- **Đề xuất luật:**
  - thêm mục **D17 "Cảnh báo lệch số"**, gồm đủ các dòng của bảng mục 6;
  - công thức chung `lệch(món) = tủ + đề nghị − (đăng ký + nợ)` tính ở server (`report-need.ts`), web dùng chung một hàm;
  - mọi cảnh báo dùng chung một thành phần, cam khi thiếu, xám khi dư, xanh khi đủ.

**GAP-02 — "ADM hết hàng" mặc định 0 và hủy, bỏ qua hàng trong tủ (và hàng ADM đã giao một phần).** (B23)
- **Thiếu gì:**
  - Đ16 và R-D11.13 cho dòng ADM hết hàng mặc định 0 và hủy hết. Điều này trái Đ25/Đ36a: HC đã đặt ít đi vì tủ có hàng (BK: tủ 2 đủ cho B, đặt 1).
  - Nếu ADM giao một phần rồi báo hết (ví dụ BB về 3/7 rồi bấm ADM hết hàng), người chưa đến lấy bị mặc định 0 và hủy, dù hàng đã về cho họ nằm trong tủ.
- **Đề xuất luật:**
  - đề xuất của dòng ADM hết hàng = **phần tủ chia được theo thứ tự đăng ký** (R-D7.9), giống dòng thường;
  - chỉ phần tủ không đủ mới vào nhóm "hủy, không thành nợ";
  - nhãn "Tủ còn s — giao từ tủ, hủy phần thiếu n".
- **Câu hỏi chủ dự án:** CH1.

**GAP-03 — Người không đến lấy món ADM hết hàng thì phần đó thành nợ ở kỳ sau và được đặt lại.** (B30, biến thể)
- **Thiếu gì:** Đ16 chỉ hủy trong hộp giao. Người không đến trước khi kỳ sau khóa thì dòng thành "Còn nợ" (Đ28) và được cộng vào đề nghị kỳ sau (Đ25). Kết quả trái "không thành nợ".
- **Đề xuất luật:** lúc khóa sổ kỳ P+1, server tự hủy phần còn lại của mọi dòng kỳ P có món đang đánh ADM hết hàng của kỳ P, sau khi trừ phần tủ đang giữ cho họ theo GAP-02:
  - `reason_code = adm_out_of_stock`;
  - chuông như R-D11.13 (người đã nghỉ thì không chuông);
  - audit `arrival.adm_out_settled`;
  - Đ19 "bỏ được tới khi giao xong" thêm vế "hoặc tới khi kỳ sau khóa sổ".
- **Câu hỏi chủ dự án:** CH2.

**GAP-04 — ADM giao bù tháng trước sau khi tháng sau đã khóa.** (B30, biến thể)
- **Thiếu gì:**
  - Hàng về chỉ cho kỳ khóa mới nhất; R-D8.10 không nói có chọn kỳ cũ được không;
  - phần chưa nhận của kỳ P thành nợ lúc P+1 khóa và được đặt lại ở P+1, dù ADM vẫn đang nợ giao theo bản in P. Hàng bị đặt trùng.
- **Đề xuất luật:**
  - Hàng về cho chọn mọi kỳ khóa còn `remaining > 0` theo bản in của kỳ đó (mặc định vẫn là K\*); `receipt_ym` = kỳ được chọn;
  - Gửi ADM kỳ P+1: số mặc định **trừ** phần nợ kỳ P mà bản in kỳ P còn chờ về (`Σ remaining` của Hàng về kỳ P, tối đa bằng nợ);
  - dòng xám ghi "= a đăng ký + b nợ − c ADM còn nợ giao (tháng P)";
  - HC đóng phần ADM còn nợ bằng nút "ADM không giao nữa" của kỳ P, sau đó phần này mới tính lại.
- **Câu hỏi chủ dự án:** CH3.

### Vừa

**GAP-05 — Món (hoặc nhóm) ngừng khi còn dòng ở kỳ khóa: Gửi ADM vẫn đề nghị, Hàng về không cho nhập.** (B24, B31)
- **Thiếu gì:** không có số mặc định hay nhãn cho món đã ngừng ở Gửi ADM. R-D11.10 chặn nhập, và cách duy nhất là bật lại món. Không có cảnh báo khi ngừng một món đang chờ ADM giao.
- **Đề xuất luật:**
  - Gửi ADM: dòng món đã ngừng có nhãn "Đã ngừng", **mặc định 0**, dòng xám "= a đăng ký (món đã ngừng — giao từ tủ hoặc giảm ở Tổng hợp)";
  - Hàng về **cho nhập** món đã ngừng nếu món có trong bản in của kỳ (đã đặt thì phải nhận được);
  - hộp ngừng món ở Danh mục / Nhóm báo "Món này đang chờ ADM giao n (bản in hh:mm)".
- **Câu hỏi chủ dự án:** CH4.

**GAP-06 — Người đã nghỉ: không có cảnh báo cho HC, và nợ của họ được đặt lại theo mặc định.** (B18)
- **Thiếu gì:**
  - không bề mặt nào báo "người đã nghỉ còn hàng chờ";
  - Đ25 cộng nợ của người đã nghỉ vào đề nghị kỳ sau.
- **Đề xuất luật:**
  - Tháng này có thẻ "n người đã nghỉ còn hàng chờ" (tên, số món) + nút mở panel Tổng hợp của người đó, chọn sẵn lý do "Người đã nghỉ";
  - Gửi ADM **không** cộng nợ của người `status ≠ active` vào số mặc định; dòng xám ghi "(bỏ b' nợ của người đã nghỉ)";
  - Còn nợ gợi ý Hủy nợ với lý do "Đã nghỉ việc".
- **Câu hỏi chủ dự án:** CH5.

**GAP-07 — Hủy nợ, "Không mua" món ngoài DM hoặc giao nợ từ tủ sau khi in làm lệch số mà không có cảnh báo.** (B32)
- **Thiếu gì:** R-X.1 chỉ xét `request_line_adjustments` và `requests.updated_at`.
- **Đề xuất luật:**
  - R-X.1 xét thêm `cancel-remaining` (`line_deliveries`/cancel có `created_at` > bản chốt) và `line.review` reject/convert sau bản chốt;
  - hộp Hủy nợ báo trước "Phiếu gửi ADM tháng N đã tính n … này — hủy thì hàng về dư vào kho" khi dòng nằm trong số nợ của bản có hàng mới nhất;
  - hộp "Không mua" cũng báo tương tự (mục 6, #13 và #24).

**GAP-08 — Tháng tủ đủ hết (tổng đề nghị = 0) làm các bước treo.** (B31, biến thể)
- **Thiếu gì:**
  - Đ30 chặn chốt, nên bước Gửi ADM không bao giờ xong;
  - Hàng về rơi về số gộp và điền sẵn hàng chờ nhập dù không đặt gì;
  - "Đủ hàng" báo sai lý do.
- **Đề xuất luật:**
  - Gửi ADM có nút phụ "Tháng này không cần đề nghị ADM", ghi `periods.no_order_at` + audit;
  - Tháng này: bước Gửi ADM "Không gửi (tủ đủ) hh:mm"; bước Hàng về "Không có đơn gửi ADM";
  - Hàng về chỉ còn "Thêm món khác";
  - bấm "Làm bản mới" thì bỏ cờ này.
- **Câu hỏi chủ dự án:** CH6.

**GAP-09 — Xuất lẻ và Kiểm kê không xét hàng đang giữ cho người chờ.** (B22, B27)
- **Thiếu gì:** FR-54 chỉ chặn khi tủ không đủ. Lấy hàng đã giữ cho người khác thì không có cảnh báo, và vì Gửi ADM đã trừ tủ đó (Đ36a), người chờ sẽ thiếu vĩnh viễn.
- **Đề xuất luật:**
  - hộp Xuất lẻ tính `free`. Nếu `qty > free` thì hiện cảnh báo cam "Xuất q sẽ lấy x đang giữ cho k người chờ", nút đổi thành "Vẫn xuất";
  - Kiểm kê: số đếm < đang giữ thì hiện "Sau kiểm kê, tủ thiếu n cho người đang chờ".
- **Câu hỏi chủ dự án:** CH7.

**GAP-10 — Trang bắt buộc nằm trong nhóm menu "Xem lại sau".** (B12, B28, B33)
- **Thiếu gì:** HC cần ba trang này trong luồng chính:
  - Tổng hợp kỳ: nơi duy nhất giảm phiếu từng người (Đ36b);
  - Còn nợ: nơi duy nhất Hủy nợ;
  - Báo cáo & in: nơi duy nhất In lại bản cũ.

  Cả ba nằm trong nhóm thu gọn "Xem lại sau" (Q18).
- **Đề xuất luật:**
  - Tổng hợp kỳ chuyển vào "Hằng tháng" (sau Tháng này). Mỗi dòng Gửi ADM có liên kết "Xem ai đăng ký (n người)", mở Tổng hợp theo món, lọc sẵn món đó;
  - Còn nợ thành tab của Giao hàng (Q5);
  - Báo cáo & in chuyển vào "Hằng tháng" hoặc có liên kết "Bản chốt cũ" từ Gửi ADM.

**GAP-11 — "Giao hàng (bản cũ)" đi vòng qua Đ3, Đ13, Đ16.** (mục 0)
- **Thiếu gì:** R-D7.2 để `/admin/delivery/classic` ngoài phạm vi, nhưng trang vẫn ở menu và vẫn giao được:
  - không qua hộp xác nhận;
  - không gợi ý theo người đăng ký trước;
  - không hủy ADM hết hàng.
- **Đề xuất luật:** gỡ khỏi menu. Route chuyển hướng `replace` sang `/admin/delivery`; hoặc giữ ở chế độ chỉ đọc (lịch sử giao) và bỏ mọi nút ghi.

**GAP-12 — Món ngoài danh mục: không ghi hàng về, không có trần giao, không có "ADM hết hàng".** (B21, B23)
- **Thiếu gì:**
  - khối món ngoài DM ở Hàng về chỉ đọc;
  - R-D7.3 dùng `min(còn nợ, tủ)` mà món ngoài DM không có tủ;
  - ADM không có món thì phải giảm ở Tổng hợp (R-X.3), đường khác với món thường.
- **Đề xuất luật:**
  - khối món ngoài DM ở Hàng về có ô "Đã về" (ghi số nhận theo khóa `custom:`, không vào tủ) và nút "ADM hết hàng" theo khóa;
  - trần giao của dòng ngoài DM = `đã về − đã giao` của khóa đó;
  - hủy khi giao dùng cùng đường R-D11.13.

**GAP-13 — "Làm bản mới" là bản thay thế hay bản bổ sung với ADM?** (R-D5.13, R-D3.6)
- **Thiếu gì:**
  - bản mới chứa **toàn bộ** số. ADM có thể hiểu là đơn thêm và đặt trùng;
  - tờ in không ghi đây là bản thay thế;
  - Hàng về đổi nguồn ngay khi in bản mới.
- **Đề xuất luật:**
  - tờ in và Excel của bản thứ hai trở đi có dòng đầu "**Bản thay thế** bản hh:mm dd/mm — ADM dùng bản này, bỏ bản trước";
  - hộp "Làm bản mới" liệt kê món đổi số so với bản trước.
- **Câu hỏi chủ dự án:** CH8.

**GAP-14 — Đổi ngày hạn ở Cấu hình không nói áp từ kỳ nào.** (B20)
- **Thiếu gì:**
  - kỳ kế đã được tạo ngay sau khóa sổ, nên đổi ngày giữa tháng thường chỉ áp cho kỳ **sau nữa**;
  - câu "kỳ đang mở giữ hạn cũ" để HC đoán kỳ đang mở là kỳ nào.
- **Đề xuất luật (giữ BR-2):**
  - ngay dưới ô có dòng sống "Kỳ tháng 01 (đang mở) vẫn khóa 00:00 ngày 11/01. Áp dụng từ kỳ tháng 02: khóa 00:00 ngày 09/02.";
  - hộp xác nhận lặp lại câu này;
  - audit ghi `effective_from_ym`.

**GAP-15 — Hạ "tối đa/tháng" khi kỳ đang mở.** (B6, B12)
- **Thiếu gì:**
  - giỏ NV không có nhãn cho dòng đã lưu vượt tối đa mới;
  - HC không biết có dòng nào vượt (Đ6 cấm lộ ở kỳ mở);
  - Tổng hợp sau khóa không có cờ "vượt tối đa".
- **Đề xuất luật:**
  - giỏ NV: "Tối đa mới 4 — giữ được 5, không tăng được";
  - Tổng hợp (kỳ khóa) có nhãn "Vượt tối đa hiện tại (4)" và lọc "Vượt tối đa";
  - khi đó lý do mặc định trong panel giảm là "Vượt định mức".

**GAP-16 — Nhắc nợ ở trang NV chỉ xem tháng liền trước.** (B10)
- **Thiếu gì:** `OwedNotice` dùng `previous` (tháng liền trước). Nợ cũ hơn (A: 2 BB tháng 11, xem từ 11/12) không hiện. Đ28 cũng không nói NV gọi tên phần này là gì.
- **Đề xuất luật:**
  - API `periods/current` trả `owed: [{ym, items, units}]` cho **mọi** kỳ khóa còn phần chưa giao;
  - dải cam liệt kê "Tháng 11: Bút bi 2 · Tháng 12: 2 món";
  - chữ cho NV: "còn chờ nhận" (không dùng "nợ" với NV).

**GAP-17 — Badge và màu đỏ ngay sau khóa sổ, trước khi đặt hàng.** (B10)
- **Thiếu gì:** R-D15.3 tô đỏ "Thiếu n cho người chờ" và badge Tủ/Kho đếm mọi món ngay khi khóa sổ (3 món), dù hàng đã đặt và đang về. Badge Giao hàng đếm 3 người khi chưa có gì để giao.
- **Đề xuất luật:**
  - `short = max(0, held − stock − đang về)`, với `đang về = Σ remaining` của Hàng về theo bản in kỳ K\*;
  - phần đang về hiện xám "Chờ hàng về n";
  - badge Giao hàng chỉ đếm người có **ít nhất một dòng giao được ngay** (tủ > 0 cho món của họ, hoặc dòng ngoài DM đã duyệt).

**GAP-18 — Cột "Đăng ký" thật ra là "chưa giao"; Báo cáo tháng đã xong rỗng.** (B15, B33)
- **Thiếu gì:** `requested` = Σ phần còn lại. Ở Gửi ADM cột này tên là "Đăng ký", sau khi giao thì số giảm. Báo cáo một kỳ đã xong có phần 1 trống.
- **Đề xuất luật:**
  - Gửi ADM: cột "Đăng ký" = số đăng ký sau điều chỉnh; thêm "đã giao" nếu > 0; công thức dùng "chưa giao";
  - Báo cáo kỳ đã có bản chốt: phần 1 lấy hàng theo bản có hàng mới nhất, kèm cột sống "Đã về" và "Đã giao" để đối chiếu.

### Thấp

**GAP-19 — Kiểm kê khớp số không ghi được.** (B27)
- **Đề xuất:** nút "Xác nhận khớp" ghi audit `stock.count_ok` (không đổi tủ). Sổ cái hiện "Đã kiểm, khớp".

**GAP-20 — Người nhận Xuất lẻ không có chuông.** (B22)
- **Đề xuất:** chuông `issue_received`: "Hành chính xuất lẻ cho bạn {{qty}} {{unit}} {{name}}: {{reason}}". Người đã nghỉ không nhận chuông.

**GAP-21 — Món hoặc nhóm bị ngừng khi NV đã có dòng: NV không được báo.** (B7, B24, B29)
- **Đề xuất:** giỏ kỳ mở hiện nhãn "Món đã ngừng — Hành chính có thể không mua. Bỏ khỏi phiếu?". Không gửi chuông, vì Đ6 cấm HC thấy và nhân viên tự thấy ở giỏ là đủ.

**GAP-22 — Chữ giờ hạn ở chuông `period_open`/`reminder` và hero NV vẫn là "23:59 ngày 10".** (B1)
- **Đề xuất:** thêm các chỗ này vào danh sách bắt buộc dùng `lockPhrase` của R-D8.11.

**GAP-23 — "Đã gửi ADM" bật ngay khi chốt bản, kể cả khi hủy hộp in.** (B16)
- **Đề xuất:** giữ Đ5 (bấm là chốt). Băng ghi "Đã chốt bản hh:mm" cho tới khi có `afterprint` hoặc HC tải Excel, sau đó mới ghi "Đã gửi ADM"; hoặc chấp nhận và đổi chữ thành "Đã chốt gửi ADM".

**GAP-24 — Dòng Đề nghị 0 có in ra phiếu ADM không.** (B31)
- **Đề xuất:** không in dòng 0 lên tờ ADM và Excel mẫu phòng. Phụ lục (nếu in) vẫn có, ghi "0 — tủ đủ".

**Đếm theo mức:** Cao 4 · Vừa 14 · Thấp 6 · **Tổng 24**.

---

## 6. Cảnh báo lệch số (Đ36): danh sách đủ app phải hiện

Ký hiệu: `d = tủ + đề nghị − (đăng ký + nợ)`. "Đăng ký" là phần chưa giao của kỳ. Món ngoài DM có tủ = 0. "Bản chốt" là bản có hàng mới nhất (R-D5.16).

| # | Nơi (trang · vị trí) | Điều kiện | Chữ (vi) | Ai thấy | Nguồn |
|---|---|---|---|---|---|
| 1 | Gửi ADM · Lập phiếu · dưới số Đề nghị | `d = 0` | Đủ cho người đăng ký | HC | Đ36 |
| 2 | Gửi ADM · Lập phiếu · dưới số Đề nghị | `d < 0` | Thiếu {{n}} — {{n}} {{unit}} sẽ không có để giao | HC | Đ36 |
| 3 | Gửi ADM · Lập phiếu · dưới số Đề nghị | `d > 0` và đề nghị > 0 | Dư {{n}} vào kho | HC | Đ36 |
| 4 | Gửi ADM · Lập phiếu · dưới số Đề nghị | `d > 0` và đề nghị = 0 | Tủ đã đủ — vẫn dư {{n}} vào kho | HC | Đ36 (B31) |
| 5 | Gửi ADM · Lập phiếu · đầu bảng | có ≥ 1 dòng thiếu hoặc dư | {{a}} món thiếu · {{b}} món dư vào kho · {{c}} món đủ | HC | Đ36 |
| 6 | Gửi ADM · dòng món đã ngừng | `usable = false` | Món đã ngừng — đề nghị mặc định 0; muốn mua thì sửa số | HC | GAP-05 |
| 7 | Gửi ADM · dòng có nợ của người đã nghỉ | nợ của `status ≠ active` > 0 | Không tính {{n}} {{unit}} nợ của người đã nghỉ | HC | GAP-06 |
| 8 | Gửi ADM · dòng có nợ ADM chưa giao bù | kỳ trước còn `remaining > 0` theo bản in | Không tính {{n}} {{unit}} nợ tháng {{m}} — ADM còn nợ giao | HC | GAP-04 |
| 9 | Gửi ADM · Đã gửi · băng đầu trang | có thay đổi sau bản chốt (điều chỉnh, phiếu lưu, Hủy nợ, Không mua, Mua lần này) | Có thay đổi sau bản chốt {{hh:mm dd/mm}} — in lại nếu cần | HC | R-X.1 (mở rộng, GAP-07) |
| 10 | Gửi ADM · Đã gửi · từng dòng đổi | nhu cầu sống ≠ lúc chốt | Bản gửi {{x}} · nay cần {{y}} → dư {{n}} vào kho / thiếu {{n}} | HC | Đ36, GAP-01 |
| 11 | Gửi ADM · trước khi chốt (hộp) | còn dòng ngoài DM chờ xem | Còn {{n}} món ngoài danh mục chưa xem; chốt vẫn thiếu các món này. | HC | FR-62 |
| 12 | Gửi ADM · nút In / Excel | tổng đề nghị = 0 | Chưa có món nào để đề nghị | HC | Đ30 |
| 13 | Món ngoài DM · hộp "Không mua" | dòng có trong bản chốt | Phiếu gửi ADM lúc {{hh:mm dd/mm}} đã có món này ({{n}} {{unit}}) — hàng về sẽ không có người nhận. | HC | GAP-07 |
| 14 | Món ngoài DM · hộp "Mua lần này" / "Mua và thêm vào danh mục" | dòng không có trong bản chốt | Phiếu gửi ADM lúc {{hh:mm dd/mm}} chưa có món này. Sau khi chấp nhận, vào Gửi ADM để làm bản mới và in lại, hoặc tự mua riêng. | HC | R-D3.6 |
| 15 | Tổng hợp kỳ · panel giảm · ngay dưới dòng, trước Lưu | giảm khi kỳ đã có bản chốt | Phiếu gửi ADM lúc {{hh:mm dd/mm}} đã tính số cũ — giảm bây giờ thì hàng về dư {{n}} {{unit}} vào kho. | HC | Đ11, Đ36 |
| 16 | Tổng hợp kỳ · dòng | `qty > max_qty` hiện tại | Vượt tối đa hiện tại ({{max}}) | HC | GAP-15 |
| 17 | Hàng về · cột Tình trạng | Về đợt này < còn lại | Thiếu {{n}} so với bản in | HC | Đ36, R-D13.7 |
| 18 | Hàng về · cột Tình trạng | Về đợt này > còn lại | Dư {{n}} so với bản in — vào kho | HC | Đ36 |
| 19 | Hàng về · nhãn dòng | có giảm sau khi gửi ADM | Đã giảm {{n}} sau khi gửi ADM — phần dư vào tủ | HC | R-D11.9 |
| 20 | Hàng về · đầu trang | ≥ 1 món giảm sau gửi | {{x}} món đã giảm sau khi gửi ADM — phần dư sẽ vào tủ | HC | R-D11.9 |
| 21 | Hàng về · hộp xác nhận Lưu (đề xuất thêm hộp này) | ≥ 1 dòng khác còn lại | Đợt này khác bản in ở {{n}} món: {{list}}. Phần thiếu chờ đợt sau. | HC | Đ36 |
| 22 | Hàng về · dòng thêm bằng "Thêm món khác" | `ordered = 0` | Món này không có trong bản in gửi ADM — nhập thẳng vào tủ | HC | Đ36 |
| 23 | Hàng về · dòng ADM hết hàng có tủ | `adm_out` và tủ > 0 | ADM hết hàng — tủ còn {{s}}: khi giao chia từ tủ theo thứ tự đăng ký, phần thiếu {{n}} hủy | HC | GAP-02 |
| 24 | Hàng về · hộp "Đủ hàng" | (như spec) | Nhập {{x}} món, {{y}} đơn vị vào tủ theo bản in {{time}}. + các dòng bỏ qua | HC | R-D11.14 |
| 25 | Giao hàng · hộp giao và panel người · dưới dòng | tủ < tổng còn chờ của món | Tủ {{s}} không đủ cho {{k}} người đang chờ {{q}} — thiếu {{q−s}} | HC | Đ36 |
| 26 | Giao hàng · hộp giao · dưới dòng | còn người đăng ký trước | Giữ {{k}} cho {{m}} người đăng ký trước | HC | R-D7.9 |
| 27 | Giao hàng · đầu trang | ≥ 1 món tủ < còn chờ | {{n}} món chưa đủ tủ cho người đang chờ — chờ đợt hàng sau | HC | Đ36 |
| 28 | Giao hàng · hộp giao · người đã nghỉ | `user_status ≠ active` | Người đã nghỉ — giao chỉ khi có người nhận thay | HC | R-D7.12 |
| 29 | Tủ / Kho · cột Trạng thái | `short > 0` (theo GAP-17: trừ phần đang về) | Thiếu {{short}} cho người chờ | HC | R-D15.3 |
| 30 | Tủ / Kho · cột Trạng thái | còn hàng đang về theo bản in | Chờ hàng về {{n}} | HC | GAP-17 |
| 31 | Tủ / Kho · hộp Xuất lẻ | `qty > free` | Xuất {{q}} sẽ lấy {{x}} {{unit}} đang giữ cho {{k}} người chờ. | HC | GAP-09 |
| 32 | Tủ / Kho · hộp Kiểm kê | số đếm < đang giữ | Sau kiểm kê tủ còn {{c}}, thiếu {{n}} cho người đang chờ. | HC | GAP-09 |
| 33 | Còn nợ · hộp Hủy nợ | dòng thuộc số nợ của bản chốt kỳ đang giao | Phiếu gửi ADM tháng {{m}} đã tính {{n}} {{unit}} này — hủy thì hàng về dư vào kho. | HC | GAP-07 |
| 34 | Danh mục món / Nhóm & đơn vị · hộp ngừng | món có `remaining > 0` theo bản in kỳ khóa | Món này đang chờ ADM giao {{n}} {{unit}} (bản in {{time}}) — ngừng thì vẫn nhập được hàng đã đặt. | HC | GAP-05 |
| 35 | Tháng này · thẻ | có người `status ≠ active` còn dòng chưa giao ở kỳ khóa | {{n}} người đã nghỉ còn hàng chờ: {{names}} | HC | GAP-06 |
| 36 | Tháng này · bước Gửi ADM | có thay đổi sau bản chốt (#9) | Đã gửi {{hh:mm dd/mm}} · có thay đổi sau đó | HC | R-X.1, R-D5.18 |
| 37 | Lịch sử NV · dòng | HC giảm | Hành chính giảm {{before}} → {{after}} {{unit}}: {{lý do}} · {{hh:mm dd/mm}} | NV | R-D6.11 |
| 38 | Chuông NV | ADM hết hàng, hủy | {{name}} ({{qty}} {{unit}}) không giao được: ADM hết hàng. Tháng sau cần thì đăng ký lại. | NV | R-D11.13 |
| 39 | Đăng ký NV · dải cam | còn chưa nhận ở **mọi** kỳ khóa | Bạn còn chờ nhận {{list theo tháng}}. Không cần đăng ký lại. | NV | GAP-16 |
| 40 | Đăng ký NV · dòng giỏ | `qty > max_qty` mới | Tối đa mới {{max}} — giữ được {{qty}}, không tăng được | NV | GAP-15 |

---

## 7. Câu hỏi cho chủ dự án

**CH1. ADM báo hết một món nhưng tủ còn hàng (hoặc ADM đã giao một phần): người đang chờ được gì?**
*Đề xuất: A.*
- A — Giao từ tủ theo thứ tự đăng ký, chỉ hủy phần tủ không đủ.
- B — Như Đ16 hiện nay: mặc định 0, hủy hết; HC tự nâng số nếu muốn giao từ tủ.
- C — Không hủy gì, để thành chưa nhận rồi thành nợ như món thường.

**CH2. Người không đến lấy món "ADM hết hàng" trước khi tháng sau khóa sổ thì sao?**
*Đề xuất: A.*
- A — Lúc khóa sổ tháng sau, app tự hủy phần đó (có chuông, không thành nợ).
- B — Để thành nợ như thường; HC tự Hủy nợ ở trang Còn nợ.
- C — Giữ chờ mãi tới khi HC giao hoặc hủy.

**CH3. ADM còn nợ giao hàng tháng trước: tháng này có đặt lại phần nợ đó không?**
*Đề xuất: A.*
- A — Không đặt lại phần ADM còn nợ giao; Hàng về cho nhập vào đúng tháng cũ khi ADM giao bù; HC bấm "ADM không giao nữa" thì mới tính lại.
- B — Vẫn đặt lại hết (như Đ25 hiện nay); HC tự sửa số nếu ADM sắp giao bù.
- C — Khi tháng sau khóa thì coi như ADM không giao nữa, không theo dõi tháng cũ.

**CH4. Món đã ngừng mà vẫn còn người đăng ký ở kỳ đã khóa sổ thì xử lý thế nào?**
*Đề xuất: A.*
- A — Gửi ADM mặc định 0 (giao từ tủ nếu có); nếu HC vẫn đặt thì Hàng về vẫn cho nhập.
- B — Vẫn đề nghị như món thường; phải bật lại món mới nhập được (như spec hiện nay).
- C — Tự giảm các dòng đó về 0 lúc khóa sổ, lý do "ADM không còn hàng".

**CH5. Người đã nghỉ còn hàng chưa nhận hoặc còn nợ thì sao?**
*Đề xuất: A.*
- A — Không cộng vào số đề nghị; Tháng này nhắc HC bỏ phần đó với lý do "Người đã nghỉ".
- B — Giữ như người thường; HC tự nhớ để bỏ.
- C — Khi PMH ID khóa tài khoản, app tự hủy hết phần chưa giao, không cần HC.

**CH6. Tháng tủ đã đủ cho mọi người (không cần đặt ADM) thì các bước ghi gì?**
*Đề xuất: A.*
- A — Có nút "Tháng này không cần đề nghị ADM"; bước Gửi ADM và Hàng về tính là xong.
- B — Cho in phiếu 0 món để lưu hồ sơ (bỏ Đ30 cho trường hợp này).
- C — Để các bước treo; HC tự hiểu.

**CH7. Xuất lẻ có được lấy hàng đang giữ cho người chờ không?**
*Đề xuất: A.*
- A — Được, nhưng hiện cảnh báo "sẽ lấy x đang giữ cho k người"; HC bấm "Vẫn xuất".
- B — Không được; chỉ xuất phần còn trống.
- C — Được, không cảnh báo (như hiện nay).

**CH8. "Làm bản mới" sau khi đã gửi ADM là bản gì đối với ADM?**
*Đề xuất: A.*
- A — Bản thay thế toàn bộ; tờ in ghi "Bản thay thế bản hh:mm — dùng bản này, bỏ bản trước".
- B — Bản bổ sung, chỉ in phần chênh lệch so với bản trước.
- C — HC chọn mỗi lần (thay thế hoặc bổ sung).

---

## 8. Lịch sử và chuông của nhân viên (tóm tắt cuối kịch bản, 14/01)

**A**
- **Chuông:**
  - 01/12 kỳ 12 mở;
  - 20/12 "Phiếu tháng 11 … giao đủ";
  - 20/12 "Phiếu tháng 12 … giao đủ".
- **Lịch sử:**
  - kỳ 11: BB "Đã nhận đủ";
  - kỳ 12: BB 3 "Đã nhận đủ", A4 2 "Đã nhận đủ";
  - kỳ 01: BB 4, BK 1 (món đã ngừng — không có nhãn, GAP-21), đang giao.

**B**
- **Chuông:**
  - 01/12 kỳ 12 mở;
  - 11/12 "Đã chấp nhận Bìa trình ký nhựa A4";
  - 11/12 "giảm Bút bi 5 → 4: Vượt định mức…";
  - 13/12 "giảm Giấy A4 5 → 3: Dự án đã cấp giấy";
  - 19/12 "Băng keo (2 cuộn) không giao được: ADM hết hàng…";
  - 13/01 "hủy phần còn nợ 2 cây Bút bi (tháng 12): Người nhận không cần nữa".
- **Lịch sử kỳ 12:**
  - BB 4 "Nhận 2 · đã hủy 2 — Người nhận không cần nữa" + dòng giảm 5 → 4;
  - A4 3 "Đã nhận đủ" + 5 → 3;
  - BK 2 "Đã hủy 2 — ADM hết hàng";
  - BÌA 2 "Đã chấp nhận · Đã nhận đủ".
- **Lịch sử kỳ 01:** A4 2.

**C**
- **Chuông:** 01/12 kỳ 12 mở. Sau 15/12 không có chuông (đã nghỉ; Đ14, Đ26).
- **Lịch sử kỳ 12:** "Hành chính đã bỏ toàn bộ: Người đã nghỉ" (Đ18, R-D6.11).

**D**
- **Chuông:** 01/12 kỳ 12 mở; 08/12 "Bạn chưa đăng ký tháng 12…".
- **Lịch sử:** "Nhận lẻ: Giấy A4 1 ram 19/12" (không có chuông, GAP-20); kỳ 01: A4 2.

---

## 9. Độ phủ trang

| Trang | Bước |
|---|---|
| Tháng này `/admin/home` | B2, B8, B10, B16, B21, B26, B30 |
| Gửi ADM `/admin/send-adm` | B15, B16, B17, B31, B32 |
| Hàng về `/admin/arrivals` | B17, B19, B21, B26 |
| Giao hàng `/admin/delivery` | B10, B19, B23, B25, B30 |
| Danh mục món `/admin/catalog` | B6, B24 |
| Tủ / Kho `/admin/stock` (Tồn kho, Xuất lẻ, Kiểm kê) | B2, B10, B21, B22, B25, B26, B27 |
| Món ngoài danh mục `/admin/review` | B11 |
| Nhóm & đơn vị `/admin/categories`, `/admin/categories/units` | B7, B14 |
| Nhân viên `/admin/users` | B8, B18 |
| Nhật ký `/admin/audit` | B34 |
| Cấu hình `/admin/config` | B20 |
| Tổng hợp kỳ `/admin/summary` | B12, B13, B17, B19 |
| Báo cáo & in `/admin/reports` + trang in | B33 |
| Còn nợ `/admin/backlog` | B28, B30, B32 |
| Giao hàng (bản cũ) `/admin/delivery/classic` | GAP-11 (chỉ để đề xuất gỡ) |
| NV Đăng ký `/` | B3–B5, B6, B7, B9, B10, B29 |
| NV Lịch sử `/history`, `/history/:ym` | B11, B13, B17, B19, B22, B23, B32, mục 8 |
| NV Tôi `/me` | không có luật nghiệp vụ mới (ngôn ngữ, hồ sơ) |
| Chuông | B1, B8, B10, B11, B13, B17, B23, B25, B30, B32 |
