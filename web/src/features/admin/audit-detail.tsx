import { useTranslation } from 'react-i18next';
import type { AuditEntry } from './admin.api';
import { changedFields, otherDetail } from './audit-diff';

const compact = (v: unknown) => JSON.stringify(v);

export function AuditDetail({ entry, id }: { entry: AuditEntry; id: string }) {
  const { t } = useTranslation();
  const d = entry.detail !== null && typeof entry.detail === 'object' ? (entry.detail as Record<string, unknown>) : {};
  const hasSides = 'before' in d || 'after' in d;
  const fields = hasSides ? changedFields(d.before, d.after) : null;
  const rest = otherDetail(entry.detail);
  return (
    <div id={id} className="au-detail">
      {fields && fields.length > 0 && (
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
                <th scope="row">{f.key}</th>
                <td>{f.before ?? t('common.empty')}</td>
                <td>{f.after ?? t('common.empty')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {fields && fields.length === 0 && <p className="au-muted">{t('audit.detail.noChange')}</p>}
      {rest.length > 0 && (
        <dl className="au-pairs">
          {rest.map((r) => (
            <div key={r.key}>
              <dt>{r.key}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {hasSides && (
        <div className="au-json">
          {'before' in d && <code>{t('audit.page.before', { json: compact(d.before) })}</code>}
          {'after' in d && <code>{t('audit.page.after', { json: compact(d.after) })}</code>}
        </div>
      )}
      <p className="au-muted">{t('audit.detail.eventId', { id: entry.id })}</p>
    </div>
  );
}
