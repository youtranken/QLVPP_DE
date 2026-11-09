import type { TFunction } from 'i18next';

const REASONS = ['locked', 'deleted', 'no_access'];
const count = (v: unknown): number => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0);

// Chuông Hành chính: người mất quyền còn việc dở (params từ api LeftWorkAlertService)
export function leftWorkText(p: Record<string, unknown>, t: TFunction): string {
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const reason = typeof p.reason === 'string' && REASONS.includes(p.reason) ? p.reason : null;
  const owed = count(p.owed_lines);
  const pending = count(p.pending_lines);
  if (!name || !reason || owed + pending === 0) return t('notifications.fallback.user_left_with_work');
  const k = 'notifications.topics.user_left_with_work';
  const work = [
    ...(owed > 0 ? [t(`${k}.owed`, { count: owed, months: t(`${k}.months`, { count: Math.max(1, count(p.owed_months)) }) })] : []),
    ...(pending > 0 ? [t(`${k}.pending`, { count: pending })] : []),
  ].join(', ');
  const open = p.open_request === true ? ` ${t(`${k}.open`)}` : '';
  return `${t(`${k}.${reason}`, { name, work })}${open}`;
}
