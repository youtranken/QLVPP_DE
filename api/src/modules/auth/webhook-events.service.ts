import { Injectable, Logger } from '@nestjs/common';
import { AuditWriterService } from '../audit/audit-writer.service';
import { toAppRole, UserAccessService } from '../users/user-access.service';
import type { SeqCategory } from '../users/user-access.service';
import { UsersService } from '../users/users.service';
import { SessionService } from './session.service';

export interface PmhWebhookEventV3 {
  type: string;
  user_id: string;
  event_id: string;
  department?: string;
  team?: string | null;
  app_role?: string;
  detail?: { client_id?: string; change?: string };
  at?: string;
}

const ACTOR = 'system(webhook)';
const REOPENABLE = ['no_access', 'locked', 'deleted'] as const;

const SEQ_CATEGORY: Record<string, SeqCategory> = {
  'user.access_revoked': 'access',
  'user.access_granted': 'access',
  'user.created': 'access',
  'user.locked': 'status',
  'user.deleted': 'status',
  'user.unlocked': 'status',
  'user.reactivated': 'status',
  'user.groups_changed': 'profile',
  'user.role_changed': 'profile',
};

// Chỉ nói về quyền vào một app cụ thể: phải đúng client của VPP
const PER_APP = new Set([
  'user.access_revoked',
  'user.access_granted',
  'user.role_changed',
]);

// Xử từng loại sự kiện PMH ID v3. Sự kiện cũ hơn cùng loại (seq nhỏ hơn) bị bỏ qua để webhook
// tới trễ không ghi đè trạng thái mới hơn.
@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(
    private readonly access: UserAccessService,
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly audit: AuditWriterService,
  ) {}

  async apply(e: PmhWebhookEventV3): Promise<void> {
    // Tài khoản cục bộ (local:sa, local-test-*) không thuộc PMH ID: bỏ qua, trả 2xx để PMH ID không retry
    if (e.user_id.startsWith('local')) {
      this.logger.warn(`Webhook ${e.type} cho tài khoản cục bộ — bỏ qua`);
      return;
    }
    const client = process.env.PMH_CLIENT_ID;
    if (PER_APP.has(e.type) && (!client || e.detail?.client_id !== client)) {
      this.logger.log(`Webhook ${e.type} của client khác — bỏ qua`);
      return;
    }
    if (e.type === 'user.password_changed') {
      await this.kick(e);
      return;
    }
    const category = SEQ_CATEGORY[e.type];
    if (!category) {
      this.logger.log(`Webhook event bỏ qua: ${e.type}`);
      return;
    }
    if (
      !(await this.access.claimSeq(e.user_id, category, BigInt(e.event_id)))
    ) {
      this.logger.log(
        `Webhook ${e.type} #${e.event_id} cũ hơn sự kiện đã áp — bỏ qua`,
      );
      return;
    }
    await this.dispatch(e);
  }

  private async dispatch(e: PmhWebhookEventV3): Promise<void> {
    switch (e.type) {
      case 'user.access_revoked':
        await this.access.setAccessRevokedMark(e.user_id, true);
        await this.access.markNoAccess(e.user_id, 'webhook', ACTOR);
        return this.kick(e);
      case 'user.access_granted':
      case 'user.created':
        return this.granted(e);
      case 'user.locked':
        return this.kick(e, 'locked');
      case 'user.deleted':
        return this.kick(e, 'deleted');
      case 'user.unlocked':
      case 'user.reactivated':
        return this.reopen(e);
      case 'user.groups_changed':
        return this.access.applyWebhookProfile(e);
      case 'user.role_changed':
        // Không hủy phiên: vai đọc DB mỗi request; PMH ID tự gửi BCL khi gỡ Quản trị viên dự án
        await this.access.applyRole(
          e.user_id,
          toAppRole(e.app_role),
          'webhook',
        );
        return;
    }
  }

  private async granted(e: PmhWebhookEventV3): Promise<void> {
    await this.access.setAccessRevokedMark(e.user_id, false);
    const user = await this.users.findBySub(e.user_id);
    if (user) {
      await this.access.applyWebhookProfile(e);
      if (user.status === 'no_access') await this.confirmGranted(e);
      return;
    }
    // Chưa có ở VPP: chỉ tạo khi Directory xác nhận; không được thì sync sau sẽ bắt
    const found = await this.access.lookup(e.user_id);
    if (found.kind === 'in') {
      await this.access.applyDirectoryUser(found.user, ACTOR);
    }
  }

  // Được cấp lại quyền nhưng có thể vẫn đang bị khóa/xóa ở PMH ID: theo Directory như reopen
  private async confirmGranted(e: PmhWebhookEventV3): Promise<void> {
    const found = await this.access.lookup(e.user_id);
    if (found.kind !== 'in') {
      this.logger.warn(
        `Webhook ${e.type} ${e.user_id}: Directory chưa xác nhận (${found.kind}) — giữ no_access, sync sau sẽ xét`,
      );
      return;
    }
    if (found.user.status === 'active') {
      await this.access.restoreActive(e.user_id, eventAt(e), 'webhook', ACTOR);
      return;
    }
    await this.users.setStatus(e.user_id, found.user.status);
  }

  // Luôn hỏi Directory trước khi mở: người đã mất quyền vào VPP không được về active
  private async reopen(e: PmhWebhookEventV3): Promise<void> {
    const askedAt = await this.access.dbNow();
    const found = await this.access.lookup(e.user_id);
    if (found.kind === 'out') {
      await this.access.markNoAccess(e.user_id, 'webhook', ACTOR);
      return;
    }
    if (found.kind === 'unknown') {
      this.logger.warn(
        `Webhook ${e.type} ${e.user_id}: không hỏi được Directory — giữ nguyên, sync sau sẽ xét`,
      );
      return;
    }
    await this.access.applyDirectoryUser(found.user, ACTOR);
    if (found.user.status === 'active') {
      // Qua restoreActive: có audit, gỡ dấu thu hồi, không mở người bị thu hồi/khóa lại sau lúc hỏi
      await this.access.restoreActive(
        e.user_id,
        askedAt,
        'webhook',
        ACTOR,
        REOPENABLE,
      );
      return;
    }
    await this.users.setStatus(e.user_id, found.user.status);
  }

  private async kick(
    e: PmhWebhookEventV3,
    status?: 'locked' | 'deleted',
  ): Promise<void> {
    if (status) await this.users.setStatus(e.user_id, status);
    const killed = await this.sessions.destroyAllForUser(e.user_id);
    await this.audit.append({
      actor: ACTOR,
      action: 'auth.session_revoked',
      objectType: 'user',
      objectId: e.user_id,
      detail: {
        event: e.type,
        sessions_killed: killed,
        ...(status ? { status } : {}),
      },
    });
  }
}

// `at` thiếu/hỏng → giờ hiện tại: điều kiện "thu hồi cũ hơn mốc" gần như luôn đúng, tức khôi phục DỄ
// hơn; chấp nhận vì seq đã xếp thứ tự và Directory đã xác nhận. `at` theo đồng hồ PMH ID, so với
// inactive_at theo đồng hồ DB, không có biên lệch giờ.
function eventAt(e: PmhWebhookEventV3): Date {
  const t = e.at ? Date.parse(e.at) : Number.NaN;
  return Number.isNaN(t) ? new Date() : new Date(t);
}
