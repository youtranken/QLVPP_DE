import type { TFunction } from 'i18next';
import type { AuditEntry } from './admin.api';
import { auditObjectName } from './audit-diff';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHORT_ID = 8;

const shortId = (id: string) => (UUID.test(id) ? `${id.slice(0, SHORT_ID)}…` : id);

export const auditObjectRef = (e: AuditEntry, short = false) =>
  [e.objectType, e.objectId && (short ? shortId(e.objectId) : e.objectId)].filter(Boolean).join(' · ');

const monthOf = (ym: string) => ({ month: Number(ym.slice(5, 7)), year: ym.slice(0, 4) });

function fromLabel(t: TFunction, e: AuditEntry): string | null {
  const l = e.objectLabel;
  if (!l) return null;
  if (l.ym && l.owner) {
    const key = e.objectType === 'request_line' && l.name ? 'audit.object.requestLine' : 'audit.object.request';
    return t(key, { ...monthOf(l.ym), owner: l.owner, name: l.name });
  }
  if (l.ym) return t(e.objectType === 'period' ? 'audit.object.period' : 'audit.object.snapshot', monthOf(l.ym));
  return l.name;
}

// Ưu tiên tên api tra lúc đọc (đối tượng còn), rồi tên ghi trong detail, cuối cùng loại · mã ngắn
export function auditObjectText(t: TFunction, e: AuditEntry): string {
  return fromLabel(t, e) ?? auditObjectName(e.detail) ?? auditObjectRef(e, true);
}
