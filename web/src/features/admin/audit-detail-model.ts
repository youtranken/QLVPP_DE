import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { reviewNoteText } from '@/lib/review-note';
import type { AuditEntry } from './admin.api';
import { changedFields, hiddenChanges, isTechnicalKey, otherDetail, readableValue, type HiddenChange } from './audit-diff';

type Value = string | null | undefined;
type ValueOf = (key: string, raw: string | null, original: unknown) => Value;

// Chỉ trường đã có nhãn tiếng Việt mới hiện: khóa lạ api thêm sau này không lộ tên thô ra cho người dùng
export function makeReadable(t: TFunction, exists: (key: string) => boolean, personName: (sub: string) => string) {
  const shown = (key: string) => !isTechnicalKey(key) && exists(`audit.fields.${key}`);
  const value: ValueOf = (key, raw, original) => {
    if (raw === null) return null;
    if (key.endsWith('_sub') && typeof original === 'string') return personName(original);
    if (typeof original === 'boolean') return t(original ? 'audit.detail.yes' : 'audit.detail.no');
    // Ghi chú duyệt lưu mã lý do app tự ghi (auto:<mã>): hiện câu dễ đọc theo ngôn ngữ người xem
    if (key === 'review_note' && typeof original === 'string') return reviewNoteText(original, t) ?? readableValue(original);
    return readableValue(original);
  };
  return { shown, value };
}

const sideOf = (side: unknown, key: string): unknown => (side !== null && typeof side === 'object' ? (side as Record<string, unknown>)[key] : undefined);

interface DetailModel {
  fields: { key: string; before: string | null; after: string | null }[];
  hidden: HiddenChange[];
  rest: { key: string; value: string | null }[];
}

export function buildDetail(entry: AuditEntry, shown: (key: string) => boolean, value: ValueOf): DetailModel {
  const d = entry.detail !== null && typeof entry.detail === 'object' ? (entry.detail as Record<string, unknown>) : {};
  const hasSides = 'before' in d || 'after' in d;
  const changed = hasSides ? (changedFields(d.before, d.after) ?? []) : [];
  const readable = changed.map((f) =>
    shown(f.key) ? { key: f.key, before: value(f.key, f.before, sideOf(d.before, f.key)), after: value(f.key, f.after, sideOf(d.after, f.key)) } : null,
  );
  const fields = readable.filter((f): f is DetailModel['fields'][number] => f !== null && f.before !== undefined && f.after !== undefined);
  const hidden = hiddenChanges(changed.filter((f) => !fields.some((x) => x.key === f.key)).map((f) => ({ key: f.key, after: sideOf(d.after, f.key) })));
  const rest = otherDetail(entry.detail)
    .filter((x) => shown(x.key))
    .map((x) => ({ key: x.key, value: value(x.key, x.value, d[x.key]) }))
    .filter((x): x is DetailModel['rest'][number] => x.value !== undefined);
  return { fields, hidden, rest };
}

// Dòng chỉ mở được khi có thứ để xem: đăng nhập, phiên bị thu hồi… không có trường nào đọc được thì không có mũi tên
export function useAuditHasDetail(): (entry: AuditEntry) => boolean {
  const { t, i18n } = useTranslation();
  return useMemo(() => {
    // Bảng hỏi cho cả ô mũi tên lẫn props dòng mỗi lần vẽ: tính một lần cho mỗi dòng nhật ký
    const seen = new WeakMap<AuditEntry, boolean>();
    // Tên người chỉ cần cho chữ hiển thị, không đổi việc có hay không — khỏi tải danh bạ cho cả trang
    const r = makeReadable(t, (k) => i18n.exists(k), (sub) => sub);
    return (entry: AuditEntry) => {
      let has = seen.get(entry);
      if (has === undefined) {
        if (entry.batch) has = entry.batch.items.length > 0;
        else {
          const m = buildDetail(entry, r.shown, r.value);
          has = m.fields.length + m.hidden.length + m.rest.length > 0;
        }
        seen.set(entry, has);
      }
      return has;
    };
  }, [t, i18n]);
}
