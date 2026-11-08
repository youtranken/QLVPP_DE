import { Inject, Injectable, Logger } from '@nestjs/common';
import { AuditWriterService } from '../audit/audit-writer.service';
import { DIRECTORY_CLIENT } from './directory.client';
import type { DirectoryClientApi, DirectoryUser } from './directory.client';
import { UserAccessService } from './user-access.service';

export type ReconcileOutcome = 'ok' | 'skipped' | 'aborted';
export type ReconcileReason =
  'empty' | 'mass_missing' | 'canary_failed' | 'rate_limited';

export interface ReconcileResult {
  no_access: number;
  unconfirmed: number;
  reconcile: ReconcileOutcome;
  reconcile_reason?: ReconcileReason;
}

// Gồm cả các trang danh bạ và canary; dưới mức 60 req/60 s của PMH ID, chừa chỗ cho webhook
export const RUN_REQUEST_BUDGET = 48;
// Vắng quá nửa user SSO (tối thiểu 5) gần như chắc là cấu hình quyền của VPP ở PMH ID sai
export const MASS_MIN = 5;
// Lỗi khiến mọi lần hỏi sau cũng hỏng → dừng, để lượt sau
const STOP_CODES = new Set(['DIRECTORY_RATE_LIMITED', 'DIRECTORY_AUTH_FAILED']);

// Directory chỉ liệt kê người đang được vào VPP: người vắng danh sách phải hỏi từng người
// (404 đúng dạng PMH ID) mới được đánh dấu no_access. Mọi dấu hiệu bất thường → hủy cả lượt.
@Injectable()
export class DirectoryReconcileService {
  private readonly logger = new Logger(DirectoryReconcileService.name);

  constructor(
    @Inject(DIRECTORY_CLIENT) private readonly directory: DirectoryClientApi,
    private readonly access: UserAccessService,
    private readonly audit: AuditWriterService,
  ) {}

  async run(
    listed: DirectoryUser[],
    syncStartedAt: Date,
    actor: string,
  ): Promise<ReconcileResult> {
    const sso = (await this.access.reconcilePool()).filter(
      (s) => !s.startsWith('local'),
    );
    const present = new Set(listed.map((u) => u.id));
    const candidates = sso.filter((s) => !present.has(s));
    if (candidates.length === 0) {
      return { no_access: 0, unconfirmed: 0, reconcile: 'ok' };
    }
    const abort = (reason: ReconcileReason) =>
      this.abort(reason, candidates.length, sso.length, actor);

    const canary = listed.find((u) => u.status === 'active');
    if (!canary) return abort('empty');
    if (candidates.length >= MASS_MIN && candidates.length * 2 > sso.length) {
      return abort('mass_missing');
    }
    // 404 cho người đang có trong danh sách = endpoint/proxy sai, không tin 404 nào lượt này
    const check = await this.access.lookup(canary.id);
    if (check.kind === 'unknown' && STOP_CODES.has(check.code ?? '')) {
      return abort('rate_limited');
    }
    if (check.kind !== 'in' || check.user.id !== canary.id) {
      return abort('canary_failed');
    }
    return this.probe(candidates, syncStartedAt, actor);
  }

  private async probe(
    candidates: string[],
    syncStartedAt: Date,
    actor: string,
  ): Promise<ReconcileResult> {
    let marked = 0;
    let probed = 0;
    let failed = 0;
    let stopped = false;
    for (const sub of candidates) {
      if (this.directory.requestCount() >= RUN_REQUEST_BUDGET) break;
      const r = await this.access.lookup(sub);
      probed += 1;
      await this.access.touchChecked(sub);
      if (r.kind === 'unknown') {
        failed += 1;
        if (STOP_CODES.has(r.code ?? '')) {
          stopped = true;
          break;
        }
        continue;
      }
      // `in`: danh sách và chi tiết lệch nhau — lượt sau xét lại
      if (
        r.kind === 'out' &&
        (await this.access.markNoAccess(sub, 'directory', actor, syncStartedAt))
      ) {
        marked += 1;
      }
    }
    const unconfirmed = candidates.length - probed + failed;
    if (unconfirmed > 0) {
      this.logger.log(
        `Đối chiếu: đã hỏi ${probed}/${candidates.length} người vắng danh bạ, ${unconfirmed} để lượt sau`,
      );
    }
    return {
      no_access: marked,
      unconfirmed,
      reconcile: stopped ? 'aborted' : 'ok',
      ...(stopped ? { reconcile_reason: 'rate_limited' as const } : {}),
    };
  }

  private async abort(
    reason: ReconcileReason,
    candidates: number,
    ssoUsers: number,
    actor: string,
  ): Promise<ReconcileResult> {
    this.logger.warn(
      `Đối chiếu bị hủy (${reason}): ${candidates}/${ssoUsers} user SSO vắng danh bạ — không đánh dấu ai`,
    );
    await this.audit.append({
      actor,
      action: 'users.directory_reconcile_aborted',
      objectType: 'users',
      detail: { reason, candidates, sso_users: ssoUsers },
    });
    return {
      no_access: 0,
      unconfirmed: candidates,
      reconcile: 'aborted',
      reconcile_reason: reason,
    };
  }
}
