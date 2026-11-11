import { useTranslation } from 'react-i18next';
import { useDirectoryNames } from '@/features/directory/use-all-users';
import type { AuditBatch, AuditEntry } from './admin.api';
import { changedFields, isTechnicalKey, otherDetail, readableValue } from './audit-diff';

type Translate = ReturnType<typeof useTranslation>['t'];

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
  const names = useDirectoryNames();
  const shown = (key: string) => !isTechnicalKey(key) && i18n.exists(`audit.fields.${key}`);
  const value = (key: string, raw: string | null, original: unknown): string | null | undefined => {
    if (raw === null) return null;
    if (key.endsWith('_sub') && typeof original === 'string') return names.data?.get(original) ?? personOf(t, original);
    if (typeof original === 'boolean') return t(original ? 'audit.detail.yes' : 'audit.detail.no');
    return readableValue(original);
  };
  return { shown, value, label: (key: string) => t(`audit.fields.${key}`) };
}

const personOf = (t: Translate, sub: string) => (sub.startsWith('system') ? t('audit.filters.system') : t('audit.detail.someone'));

const sideOf = (side: unknown, key: string): unknown => (side !== null && typeof side === 'object' ? (side as Record<string, unknown>)[key] : undefined);

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
  const fields = (hasSides ? (changedFields(d.before, d.after) ?? []) : [])
    .filter((f) => r.shown(f.key))
    .map((f) => ({ key: f.key, before: r.value(f.key, f.before, sideOf(d.before, f.key)), after: r.value(f.key, f.after, sideOf(d.after, f.key)) }))
    .filter((f) => f.before !== undefined && f.after !== undefined);
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
      {hasSides && fields.length === 0 && rest.length === 0 && <p className="au-muted">{t('audit.detail.noChange')}</p>}
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
