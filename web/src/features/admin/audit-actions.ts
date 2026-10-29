// Mọi action api ghi vào audit_log; test audit-actions.test.ts quét api/src để không sót
export const AUDIT_ACTIONS: readonly string[] = [
  'auth.login',
  'auth.login_denied_group',
  'auth.login_denied_idp',
  'auth.login_failed',
  'auth.logout',
  'auth.sa_login',
  'auth.sa_login_failed',
  'auth.session_expired',
  'auth.session_revoked',
  'auth.webhook_rejected',
  'category.created',
  'category.updated',
  'config.updated',
  'files.orphans_deleted',
  'files.uploaded',
  'item.created',
  'item.deactivated',
  'item.deleted',
  'item.updated',
  'line.cancel_remaining',
  'line.delivered',
  'line.review',
  'period.headcount_recorded',
  'report.snapshot_created',
  'request.created',
  'request.deleted',
  'request.updated',
  'stock.adjust',
  'stock.delivery',
  'stock.issue',
  'stock.purchase',
  'users.directory_sync',
];

type Translate = (key: string, opts?: { defaultValue?: string }) => string;

// Mã lạ (api mới hơn web) hiện mã thô thay vì trống
export function auditActionLabel(t: Translate, action: string): string {
  return AUDIT_ACTIONS.includes(action) ? t(`audit.actions.${action}`, { defaultValue: action }) : action;
}
