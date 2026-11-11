import { useTranslation } from 'react-i18next';
import { usePersonName } from '@/features/directory/use-all-users';
import { categoryLabel, useAllCategories } from '@/features/catalog/catalog.api';
import type { AuditBatch, AuditEntry } from './admin.api';
import type { HiddenChange } from './audit-diff';
import { buildDetail, makeReadable } from './audit-detail-model';

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
