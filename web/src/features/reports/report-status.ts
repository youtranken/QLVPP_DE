import type { TFunction } from 'i18next';
import { formatVnStamp } from '@/lib/format-time';
import type { SendState } from '@/features/send-adm/use-send-state';

export type StatusTone = 'ok' | 'warn' | 'plain';

// Trạng thái gửi NCC của kỳ trong một dòng: đã gửi (kèm số món đổi sau bản), chưa gửi, không cần đề nghị
export function reportStatus(send: Pick<SendState, 'state' | 'sent' | 'noOrder'>, rowsChanged: number, t: TFunction): { tone: StatusTone; parts: string[]; changed: string | null } {
  const parts: string[] = [];
  let changed: string | null = null;
  let tone: StatusTone = 'plain';
  if (send.state === 'sent' && send.sent) {
    tone = rowsChanged > 0 ? 'warn' : 'ok';
    parts.push(t('reports.send.status.sent', { time: formatVnStamp(send.sent.created_at) }));
    if (rowsChanged > 0) changed = t('reports.send.status.changed', { n: rowsChanged });
  } else if (send.state === 'no_order' && send.noOrder) {
    tone = 'ok';
    parts.push(t('reports.send.status.noOrder', { time: formatVnStamp(send.noOrder.at) }));
  } else {
    tone = 'warn';
    parts.push(t('reports.send.status.unsent'));
  }
  return { tone, parts, changed };
}
