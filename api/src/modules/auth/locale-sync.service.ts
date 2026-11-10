import { Inject, Injectable, Logger } from '@nestjs/common';
import { IDP_LOCALE_CLIENT } from './idp-locale.client';
import type { IdpLocaleApi, IdpLocaleResult } from './idp-locale.client';
import type { AppLocale } from './locale';
import { SessionAuthService } from './session-auth.service';
import { SessionService } from './session.service';
import type { SessionRecord } from './session.service';

export interface LocaleSaveResult {
  locale: AppLocale;
  saved: boolean;
  reason?: string;
  retryAfterSec?: number;
}

// Một lần bấm VI/EN: `page` = mã ngẫu nhiên của lần tải trang, `seq` = thứ tự lần bấm trong trang
export interface LocaleClick {
  page: string;
  seq: number;
}

interface SessionQueue {
  tail: Promise<unknown>;
  // số thứ tự lượt mới nhất đã nhận
  latest: number;
  // đã có lượt lưu thành công mà claims phiên chưa refresh theo
  dirty: boolean;
}

/**
 * Lưu ngôn ngữ vào tài khoản PMH ID (docs 7a) cho một phiên SSO:
 * - Thứ tự theo LẦN BẤM: web gửi {page, seq}; seq ≤ seq lớn nhất đã nhận của cùng trang ⇒ `stale`.
 *   Trang khác (tải lại, tab khác) không so seq — theo thứ tự tới. Nhớ seq CLICK_MEMORY_MS.
 * - Tuần tự theo phiên + mới nhất thắng: lượt chưa chạy mà đã có lượt mới hơn ⇒ `superseded`.
 * - PMH ID 401 ⇒ refresh MỘT lần rồi thử lại. Phiên chưa có access token (lưu trước bản này) ⇒
 *   refresh trước.
 * - Lưu được ⇒ ghi locale vào claims phiên ngay (không nhảy về claim cũ), lượt cuối refresh MỘT lần
 *   để token/claims khớp tài khoản. Refresh sau khi lưu lỗi không làm hỏng kết quả.
 * - Không bao giờ ném. Log không chứa token/email/mã phiên.
 * Giới hạn: tuần tự trong MỘT tiến trình api (hiện chạy một container api).
 */
@Injectable()
export class LocaleSyncService {
  private readonly logger = new Logger(LocaleSyncService.name);
  static readonly CLICK_MEMORY_MS = 10 * 60 * 1000;
  private readonly queues = new Map<string, SessionQueue>();
  private readonly clicks = new Map<
    string,
    Map<string, { seq: number; at: number }>
  >();
  private seq = 0;

  constructor(
    private readonly sessions: SessionService,
    private readonly sessionAuth: SessionAuthService,
    @Inject(IDP_LOCALE_CLIENT) private readonly idp: IdpLocaleApi,
  ) {}

  save(
    sessionId: string,
    locale: AppLocale,
    userIp?: string,
    click?: LocaleClick,
  ): Promise<LocaleSaveResult> {
    this.pruneClicks(Date.now());
    // Kiểm-và-ghi đồng bộ (trước mọi await): hai request tới cùng lúc không lọt cả hai
    if (click && !this.acceptClick(sessionId, click)) {
      return Promise.resolve({ locale, saved: false, reason: 'stale' });
    }
    const mine = ++this.seq;
    const queue = this.queues.get(sessionId) ?? {
      tail: Promise.resolve(),
      latest: mine,
      dirty: false,
    };
    queue.latest = mine;
    const run = queue.tail
      .catch(() => undefined)
      .then(() => this.run(sessionId, queue, locale, mine, userIp));
    queue.tail = run;
    this.queues.set(sessionId, queue);
    void run
      .catch(() => undefined)
      .finally(() => {
        if (queue.tail === run && this.queues.get(sessionId) === queue) {
          this.queues.delete(sessionId);
        }
      });
    return run;
  }

  private acceptClick(sessionId: string, click: LocaleClick): boolean {
    let pages = this.clicks.get(sessionId);
    const seen = pages?.get(click.page);
    if (seen && click.seq <= seen.seq) return false;
    if (!pages) {
      pages = new Map();
      this.clicks.set(sessionId, pages);
    }
    pages.set(click.page, { seq: click.seq, at: Date.now() });
    return true;
  }

  private pruneClicks(now: number): void {
    for (const [sessionId, pages] of this.clicks) {
      for (const [page, seen] of pages) {
        if (now - seen.at > LocaleSyncService.CLICK_MEMORY_MS)
          pages.delete(page);
      }
      if (pages.size === 0) this.clicks.delete(sessionId);
    }
  }

  private async run(
    sessionId: string,
    queue: SessionQueue,
    locale: AppLocale,
    mine: number,
    userIp?: string,
  ): Promise<LocaleSaveResult> {
    if (queue.latest !== mine) {
      return { locale, saved: false, reason: 'superseded' };
    }
    let result: LocaleSaveResult;
    try {
      result = await this.putWithRetry(sessionId, locale, userIp);
      if (result.saved) {
        queue.dirty = true;
        await this.sessions.setSessionLocale(
          sessionId,
          locale,
          Math.floor(Date.now() / 1000),
        );
      }
    } catch (error) {
      this.logger.warn(`Lưu ngôn ngữ PMH ID lỗi: ${(error as Error).name}`);
      result = { locale, saved: false, reason: 'unavailable' };
    }
    // Lượt cuối: một refresh cho mọi lượt thành công trước đó — token mới mang locale mới
    if (queue.latest === mine && queue.dirty) {
      queue.dirty = false;
      try {
        await this.sessionAuth.refreshNow(sessionId);
      } catch (error) {
        this.logger.warn(
          `Refresh sau khi lưu ngôn ngữ lỗi: ${(error as Error).name}`,
        );
      }
    }
    return result;
  }

  private async putWithRetry(
    sessionId: string,
    locale: AppLocale,
    userIp?: string,
  ): Promise<LocaleSaveResult> {
    let session = await this.sessions.find(sessionId);
    if (session && !session.accessToken) {
      session = await this.sessionAuth.refreshNow(sessionId);
    }
    if (!session?.accessToken) {
      return { locale, saved: false, reason: 'no_token' };
    }
    let result = await this.put(session, locale, userIp);
    if (!result.ok && result.reason === 'unauthorized') {
      session = await this.sessionAuth.refreshNow(sessionId);
      if (!session?.accessToken) {
        return { locale, saved: false, reason: 'unauthorized' };
      }
      result = await this.put(session, locale, userIp);
    }
    if (!result.ok) {
      this.logger.warn(
        `Không lưu được ngôn ngữ vào PMH ID cho ${session.userSub}: ${result.reason}`,
      );
      return {
        locale,
        saved: false,
        reason: result.reason,
        ...(result.retryAfterSec !== undefined
          ? { retryAfterSec: result.retryAfterSec }
          : {}),
      };
    }
    if (result.locale !== locale) {
      this.logger.warn(
        `PMH ID báo lưu ${String(result.locale)} khác giá trị gửi ${locale} (${session.userSub})`,
      );
      return { locale, saved: false, reason: 'mismatch' };
    }
    return { locale, saved: true };
  }

  private put(
    session: SessionRecord,
    locale: AppLocale,
    userIp?: string,
  ): Promise<IdpLocaleResult> {
    return this.idp.putLocale(session.accessToken as string, locale, {
      userIp,
    });
  }
}
