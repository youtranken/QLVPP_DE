/**
 * Dịch dữ liệu PMH ID gửi sang dạng VPP dùng.
 *
 * Tách riêng ra đây vì cả ba hàm dưới đều từng sai: VPP được viết theo `mock-idp`,
 * mà mock-idp KHÔNG giống PMH ID thật ở đúng những chỗ này. Lỗi chỉ lộ ra khi cắm
 * vào IdP thật, nên giữ chúng thuần hàm để test bằng dữ liệu thật của PMH ID.
 */

/** Bản ghi danh bạ, chấp nhận cách đặt tên của CẢ PMH ID lẫn mock-idp. */
export interface RawDirectoryUser {
  /** PMH ID dùng `id`; mock-idp dùng `sub`. */
  id?: string | null;
  sub?: string | null;
  email?: string | null;
  full_name?: string | null;
  employee_code?: string | null;
  groups?: string[] | null;
  /** PMH ID dùng `status` ('active' | 'locked' | 'deleted'); mock-idp dùng `disabled`. */
  status?: string | null;
  disabled?: boolean | null;
}

export interface DirectoryUser {
  sub: string;
  email: string | null;
  full_name: string | null;
  employee_code: string | null;
  groups: string[];
  disabled: boolean;
}

/**
 * Rút danh sách bản ghi từ phản hồi `GET /api/v1/users`.
 *
 * PMH ID trả về **mảng thuần** (`directory.service.ts` trả thẳng `rows`), còn
 * mock-idp bọc trong `{ items }`. Đọc nhầm thì `items` là `undefined` ⇒ đồng bộ
 * 0 người mà vẫn ghi nhật ký "thành công" — hỏng im lặng, rất khó phát hiện.
 */
export function parseDirectoryPage(payload: unknown): RawDirectoryUser[] {
  if (Array.isArray(payload)) return payload as RawDirectoryUser[];
  if (payload && typeof payload === 'object') {
    const items = (payload as { items?: unknown }).items;
    if (Array.isArray(items)) return items as RawDirectoryUser[];
  }
  return [];
}

/**
 * Chuẩn hoá một bản ghi. Trả `null` khi thiếu định danh — bản ghi không có `sub`
 * lẫn `id` thì không upsert được, vì `pmh_sub` là khoá tham chiếu.
 */
export function normalizeDirectoryUser(raw: RawDirectoryUser): DirectoryUser | null {
  const sub = raw.sub ?? raw.id;
  if (!sub) return null;
  return {
    sub,
    email: raw.email ?? null,
    full_name: raw.full_name ?? null,
    employee_code: raw.employee_code ?? null,
    groups: raw.groups ?? [],
    // `disabled` tường minh thắng; không có thì suy từ `status` của PMH ID.
    // Mọi trạng thái khác 'active' (locked, deleted…) đều coi là bị khoá.
    disabled: raw.disabled ?? (raw.status ? raw.status !== 'active' : false),
  };
}

/**
 * Đưa timestamp webhook về mili giây.
 *
 * PMH ID gửi **giây** (`webhook-worker.service.ts`: `Math.floor(Date.now()/1000)`),
 * mock-idp gửi **mili giây** (`String(Date.now())`). So thẳng với `Date.now()` thì
 * gói thật lệch ~1,79 tỉ ⇒ vượt mọi cửa sổ ⇒ TỪ CHỐI SẠCH mọi webhook thật.
 *
 * Mốc phân biệt 1e12 ms = 09/09/2001, nên mọi giá trị nhỏ hơn chắc chắn là giây.
 */
export function webhookTimestampToMs(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n;
}
