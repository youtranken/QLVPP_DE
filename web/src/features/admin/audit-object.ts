import type { TFunction } from 'i18next';
import type { AuditEntry } from './admin.api';
import { auditObjectName } from './audit-diff';

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

// Không tra được tên (đã xóa): tên loại tiếng Việt; loại lạ (api mới hơn web) ghi "—", không hiện khóa thô
function fallback(t: TFunction, e: AuditEntry): string {
  return (e.objectType && t(`audit.objectType.${e.objectType}`, { defaultValue: '' })) || t('common.empty');
}

// Ưu tiên tên api tra lúc đọc (đối tượng còn), rồi tên ghi trong detail
export function auditObjectText(t: TFunction, e: AuditEntry): string {
  return fromLabel(t, e) ?? auditObjectName(e.detail) ?? fallback(t, e);
}
