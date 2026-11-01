import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api-client';
import { formatVnStamp } from '@/lib/format-time';
import { LoadError } from '@/ui/load-state';
import type { AuditEntry } from './admin.api';
import { changedFields } from './audit-diff';

const RECENT_LIMIT = 3;

// objectId của config.updated là danh sách khóa đã gửi; trước/sau cho biết khóa nào thật sự đổi
function changedKeys(entry: AuditEntry): string[] {
  const d = entry.detail as { before?: unknown; after?: unknown } | null;
  const diff = d ? changedFields(d.before, d.after) : null;
  if (diff && diff.length > 0) return diff.map((f) => f.key);
  return (entry.objectId ?? '').split(',').filter(Boolean);
}
const AUDIT_LINK = '/admin/audit?action=config.updated';

export function RecentChanges() {
  const { t } = useTranslation();
  const titleId = useId();
  const recent = useQuery({
    queryKey: ['audit', 'config-recent'],
    queryFn: () => apiFetch<{ items: AuditEntry[] }>(`/api/admin/audit?action=config.updated&limit=${RECENT_LIMIT}`),
  });
  const rows = recent.data?.items ?? [];
  return (
    <section className="cf-aside__card" aria-labelledby={titleId}>
      <h2 id={titleId}>{t('config.recent.title')}</h2>
      {recent.isError ? (
        <LoadError onRetry={() => void recent.refetch()} />
      ) : (
        recent.data && (
          <ul className="cf-recent">
            {rows.length === 0 && <li className="cf-muted">{t('config.recent.empty')}</li>}
            {rows.map((r) => (
              <li key={r.id}>
                <span>{t('config.recent.row', { time: formatVnStamp(r.createdAt), who: r.actorName ?? r.actor })}</span>
                {changedKeys(r).length > 0 && (
                  <small className="cf-muted">
                    {t('config.recent.changed', { keys: changedKeys(r).map((k) => t(`audit.fields.${k}`, { defaultValue: k })).join(', ') })}
                  </small>
                )}
              </li>
            ))}
          </ul>
        )
      )}
      <Link to={AUDIT_LINK}>{t('config.recent.viewAll')}</Link>
    </section>
  );
}
