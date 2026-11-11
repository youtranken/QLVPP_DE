import { useTranslation } from 'react-i18next';
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

// Chỉ trường đã có nhãn tiếng Việt mới hiện: khóa lạ api thêm sau này không lộ tên thô ra cho người dùng
function useReadable() {
  const { t, i18n } = useTranslation();
  const personName = usePersonName();
  const shown = (key: string) => !isTechnicalKey(key) && i18n.exists(`audit.fields.${key}`);
  const value = (key: string, raw: string | null, original: unknown): string | null | undefined => {
    if (raw === null) return null;
    if (key.endsWith('_sub') && typeof original === 'string') return personName(original);
    if (typeof original === 'boolean') return t(original ? 'audit.detail.yes' : 'audit.detail.no');
    // Ghi chú duyệt lưu mã lý do app tự ghi (auto:<mã>): hiện câu dễ đọc theo ngôn ngữ người xem
    if (key === 'review_note' && typeof original === 'string') return reviewNoteText(original, t) ?? readableValue(original);
    return readableValue(original);
  };
  return { shown, value, label: (key: string) => t(`audit.fields.${key}`) };
}

const sideOf = (side: unknown, key: string): unknown => (side !== null && typeof side === 'object' ? (side as Record<string, unknown>)[key] : undefined);

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
  const { t } = useTranslation();
  const r = useReadable();
  if (entry.batch) {
    return (
      <div id={id} className="au-detail">
        <BatchItems batch={entry.batch} />
      </div>
    );
  }
  const d = entry.detail !== null && typeof entry.detail === 'object' ? (entry.detail as Record<string, unknown>) : {};
  const hasSides = 'before' in d || 'after' in d;
  const changed = hasSides ? (changedFields(d.before, d.after) ?? []) : [];
  const readable = changed.map((f) =>
    r.shown(f.key) ? { key: f.key, before: r.value(f.key, f.before, sideOf(d.before, f.key)), after: r.value(f.key, f.after, sideOf(d.after, f.key)) } : null,
  );
  const fields = readable.filter((f): f is { key: string; before: string | null; after: string | null } => f !== null && f.before !== undefined && f.after !== undefined);
  const hidden = hiddenChanges(changed.filter((f) => !fields.some((x) => x.key === f.key)).map((f) => ({ key: f.key, after: sideOf(d.after, f.key) })));
  const rest = otherDetail(entry.detail)
    .filter((x) => r.shown(x.key))
    .map((x) => ({ key: x.key, value: r.value(x.key, x.value, d[x.key]) }))
    .filter((x) => x.value !== undefined);
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
                <th scope="row">{r.label(f.key)}</th>
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
      {hasSides && changed.length === 0 && rest.length === 0 && <p className="au-muted">{t('audit.detail.noChange')}</p>}
      {rest.length > 0 && (
        <dl className="au-pairs">
          {rest.map((x) => (
            <div key={x.key}>
              <dt>{r.label(x.key)}</dt>
              <dd>{x.value ?? t('common.empty')}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
