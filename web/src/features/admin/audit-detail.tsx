import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { reviewNoteText } from '@/lib/review-note';
import { usePersonName } from '@/features/directory/use-all-users';
import { categoryLabel, useAllCategories } from '@/features/catalog/catalog.api';
import type { AuditBatch, AuditEntry } from './admin.api';
import { changedFields, hiddenChanges, isTechnicalKey, otherDetail, readableValue, type HiddenChange } from './audit-diff';

function BatchItems({ batch }: { batch: AuditBatch }) {
  const { t, i18n } = useTranslation();
  return (
    <ul className="au-batch" aria-label={t('audit.batch.items')}>
      {batch.items.map((i) => (
        <li key={i.item_id}>{t('audit.batch.line', { name: (i18n.language === 'en' && i.name_en) || i.name, qty: i.qty })}</li>
      ))}
    </ul>
  );
}

type Value = string | null | undefined;
type ValueOf = (key: string, raw: string | null, original: unknown) => Value;

// Chỉ trường đã có nhãn tiếng Việt mới hiện: khóa lạ api thêm sau này không lộ tên thô ra cho người dùng
function makeReadable(t: TFunction, exists: (key: string) => boolean, personName: (sub: string) => string) {
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

function buildDetail(entry: AuditEntry, shown: (key: string) => boolean, value: ValueOf): DetailModel {
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
  return useCallback(
    (entry: AuditEntry) => {
      if (entry.batch) return entry.batch.items.length > 0;
      // Tên người chỉ cần cho chữ hiển thị, không đổi việc có hay không — khỏi tải danh bạ cho cả trang
      const r = makeReadable(t, (k) => i18n.exists(k), (sub) => sub);
      const m = buildDetail(entry, r.shown, r.value);
      return m.fields.length + m.hidden.length + m.rest.length > 0;
    },
    [t, i18n],
  );
}

function HiddenLine({ change }: { change: HiddenChange }) {
  const { t, i18n } = useTranslation();
  const categories = useAllCategories(change.kind === 'category' && change.id !== null);
  if (change.kind === 'image') return <li>{t('audit.detail.imageChanged')}</li>;
  if (change.kind === 'category') {
    const list = Array.isArray(categories.data) ? categories.data : [];
    const c = change.id ? list.find((x) => x.id === change.id) : undefined;
    return <li>{c ? t('audit.detail.categoryTo', { name: categoryLabel(c, i18n.language) }) : t('audit.detail.categoryChanged')}</li>;
  }
  return <li>{t('audit.detail.otherChanged')}</li>;
}

export function AuditDetail({ entry, id }: { entry: AuditEntry; id: string }) {
  const { t, i18n } = useTranslation();
  const personName = usePersonName();
  if (entry.batch) {
    return (
      <div id={id} className="au-detail">
        <BatchItems batch={entry.batch} />
      </div>
    );
  }
  const r = makeReadable(t, (k) => i18n.exists(k), personName);
  const { fields, hidden, rest } = buildDetail(entry, r.shown, r.value);
  const label = (key: string) => t(`audit.fields.${key}`);
  return (
    <div id={id} className="au-detail">
      {fields.length > 0 && (
        <table className="au-diff">
          <thead>
            <tr>
              <th scope="col">{t('audit.detail.field')}</th>
              <th scope="col">{t('audit.detail.before')}</th>
              <th scope="col">{t('audit.detail.after')}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.key}>
                <th scope="row">{label(f.key)}</th>
                <td>{f.before ?? t('common.empty')}</td>
                <td>{f.after ?? t('common.empty')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hidden.length > 0 && (
        <ul className="au-hidden">
          {hidden.map((c) => (
            <HiddenLine key={c.kind} change={c} />
          ))}
        </ul>
      )}
      {rest.length > 0 && (
        <dl className="au-pairs">
          {rest.map((x) => (
            <div key={x.key}>
              <dt>{label(x.key)}</dt>
              <dd>{x.value ?? t('common.empty')}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
