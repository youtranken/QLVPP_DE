import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OIDC_PROVIDER } from '../auth/oidc-provider';
import type { OidcProvider } from '../auth/oidc-provider';

// Hợp đồng v3: `id` = claim `sub`; department "" = chưa xếp Phòng; team null = trực thuộc Phòng.
// Danh sách chỉ gồm người đang được vào VPP: người mất quyền biến mất (không hiện deleted).
export interface DirectoryUser {
  id: string;
  employee_code?: string;
  email?: string;
  full_name?: string;
  department?: string;
  team?: string | null;
  app_role?: string;
  status: 'active' | 'locked' | 'deleted';
}

export const DIRECTORY_CLIENT = 'DIRECTORY_CLIENT';
export const DIRECTORY_SLEEP = 'DIRECTORY_SLEEP';

export interface DirectoryClientApi {
  // Đủ mọi trang; lỗi ở bất kỳ trang nào → ném, không bao giờ trả danh sách thiếu
  fetchUsers(): Promise<DirectoryUser[]>;
  // 404 đúng dạng PMH ID → null (ra khỏi phạm vi VPP); mọi lỗi khác → ném
  fetchUser(id: string): Promise<DirectoryUser | null>;
  requestCount(): number;
  resetCount(): void;
}

export type Sleep = (ms: number) => Promise<void>;

// Trần `limit` của PMH ID: trang đủ 200 nghĩa là còn trang sau
export const DIRECTORY_PAGE_SIZE = 200;
// 10 000 user (thêm một lượt hỏi trang rỗng để xác nhận hết); vượt thì lỗi chứ không coi danh sách là đầy đủ
export const MAX_PAGES = 50;
export const RATE_LIMIT_RETRIES = 3;
const RETRY_AFTER_DEFAULT_MS = 5_000;
const RETRY_AFTER_CAP_MS = 10_000;
const FETCH_TIMEOUT_MS = 15_000;

function apiBase(): string {
  const issuer = new URL(process.env.PMH_ISSUER_URL as string);
  return `${issuer.protocol}//${issuer.host}`;
}

// PMH ID hiện không gửi Retry-After (cửa sổ trượt 60 req/60 s) → chờ mặc định
function retryAfterMs(header: string | null | undefined): number {
  const secs = header == null || header === '' ? NaN : Number(header);
  const ms =
    Number.isFinite(secs) && secs >= 0 ? secs * 1000 : RETRY_AFTER_DEFAULT_MS;
  return Math.min(ms, RETRY_AFTER_CAP_MS);
}

function unavailable(message: string): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'DIRECTORY_UNAVAILABLE',
    message,
  });
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

@Injectable()
export class DirectoryClient implements DirectoryClientApi {
  private readonly logger = new Logger(DirectoryClient.name);
  private readonly sleep: Sleep;
  private sent = 0;

  constructor(
    @Inject(OIDC_PROVIDER) private readonly oidc: OidcProvider,
    @Optional() @Inject(DIRECTORY_SLEEP) sleep?: Sleep,
  ) {
    this.sleep =
      sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  requestCount(): number {
    return this.sent;
  }

  resetCount(): void {
    this.sent = 0;
  }

  async fetchUsers(): Promise<DirectoryUser[]> {
    // Không gửi include_deleted: PMH ID trả người đã xóa với status "active"; người vắng danh sách đi qua đối chiếu 404
    const all: DirectoryUser[] = [];
    const seen = new Set<string>();
    // Trang MAX_PAGES (thứ 51) chỉ để xác nhận đã hết: đúng 10 000 user vẫn đồng bộ được
    for (let page = 0; page <= MAX_PAGES; page += 1) {
      const offset = page * DIRECTORY_PAGE_SIZE;
      const { body } = await this.get(
        `/api/v1/users?limit=${DIRECTORY_PAGE_SIZE}&offset=${offset}`,
      );
      // Không đoán dạng khác: mảng rỗng giả sẽ khiến đối chiếu đánh dấu nhầm cả công ty
      if (!Array.isArray(body) || !body.every(isObject)) {
        throw unavailable(
          'Directory API trả dữ liệu không đúng hợp đồng — đồng bộ bị hủy.',
        );
      }
      const items = body as unknown as DirectoryUser[];
      if (page === MAX_PAGES && items.length > 0) break;
      const fresh = items.filter((u) => !seen.has(u.id));
      if (items.length > 0 && fresh.length === 0) {
        throw unavailable(
          'Directory API phân trang không đúng (trang lặp lại) — đồng bộ bị hủy.',
        );
      }
      fresh.forEach((u) => seen.add(u.id));
      all.push(...fresh);
      if (items.length < DIRECTORY_PAGE_SIZE) return all;
    }
    throw unavailable(
      `Directory API vượt ${MAX_PAGES} trang — đồng bộ bị hủy để tránh danh sách thiếu.`,
    );
  }

  async fetchUser(id: string): Promise<DirectoryUser | null> {
    const { status, body } = await this.get(
      `/api/v1/users/${encodeURIComponent(id)}`,
      true,
    );
    if (status === 404) return null;
    if (!isObject(body) || typeof body.id !== 'string') {
      throw unavailable('Directory API trả dữ liệu user không hợp lệ.');
    }
    return body as unknown as DirectoryUser;
  }

  private async get(
    path: string,
    allow404 = false,
  ): Promise<{ status: number; body: unknown }> {
    let response = await this.fetchWithRetry(path, false);
    if (response.status === 401 || response.status === 403) {
      // Token cache có thể bị thu hồi sớm — thử lại một lần với token mới
      response = await this.fetchWithRetry(path, true);
    }
    if (response.status === 401 || response.status === 403) {
      throw new BadGatewayException({
        code: 'DIRECTORY_AUTH_FAILED',
        message: 'PMH ID từ chối token M2M — kiểm tra quyền client với SA.',
      });
    }
    if (allow404 && response.status === 404) {
      await this.assertPmhNotFound(response);
      return { status: 404, body: null };
    }
    if (!response.ok) {
      throw unavailable(
        `Directory API lỗi (HTTP ${response.status}) — thử lại sau.`,
      );
    }
    try {
      return { status: response.status, body: await response.json() };
    } catch {
      throw unavailable(
        'Directory API trả dữ liệu không hợp lệ — thử lại sau.',
      );
    }
  }

  // 404 của proxy/route sai (HTML, JSON lạ) không được hiểu là "user mất quyền"
  private async assertPmhNotFound(response: Response): Promise<void> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (
      !isObject(body) ||
      body.statusCode !== 404 ||
      body.error !== 'Not Found' ||
      // 404 route sai của chính Nest (cấu hình đường dẫn API lệch) không phải "user mất quyền"
      (typeof body.message === 'string' && body.message.startsWith('Cannot '))
    ) {
      throw unavailable(
        'Directory API trả 404 không đúng dạng PMH ID — không xác nhận được.',
      );
    }
  }

  private async fetchWithRetry(
    path: string,
    forceToken: boolean,
  ): Promise<Response> {
    for (let attempt = 0; ; attempt += 1) {
      const response = await this.doFetch(path, forceToken && attempt === 0);
      if (response.status !== 429) return response;
      if (attempt >= RATE_LIMIT_RETRIES) {
        this.logger.warn(
          `Directory API 429 sau ${RATE_LIMIT_RETRIES} lần thử lại: ${path.split('?')[0]}`,
        );
        throw new ServiceUnavailableException({
          code: 'DIRECTORY_RATE_LIMITED',
          message:
            'Tài khoản D&E đang giới hạn tần suất đọc danh bạ — thử lại sau ít phút.',
        });
      }
      await this.sleep(retryAfterMs(response.headers?.get('retry-after')));
    }
  }

  private async doFetch(path: string, forceToken: boolean): Promise<Response> {
    let token: string;
    try {
      token = await this.oidc.clientCredentialsToken(forceToken);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      // WARN từng lần gọi; ERROR một lần mỗi đợt sự cố do scheduler ghi
      this.logger.warn(`Lấy token M2M thất bại: ${(error as Error).message}`);
      throw new BadGatewayException({
        code: 'DIRECTORY_AUTH_FAILED',
        message:
          'Không xác thực được với PMH ID (kiểm tra client_id/secret) — đồng bộ bị hủy.',
      });
    }
    this.sent += 1;
    try {
      return await fetch(`${apiBase()}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(
        `Directory API không liên lạc được: ${(error as Error).message}`,
      );
      throw unavailable(
        'Không kết nối được danh bạ Tài khoản D&E — thử lại sau.',
      );
    }
  }
}
