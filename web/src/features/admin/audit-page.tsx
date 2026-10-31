import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorFields } from '@/lib/api-error';
import { FilterNotice } from '@/ui/filter-notice';
import { LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { useAuditLog } from './admin.api';
import { AuditFilterBar } from './audit-filters';
import { AuditQuick } from './audit-quick';
import { AuditTable } from './audit-table';
import { useAuditParams } from './use-audit-params';
import './audit.m1.css';

export function AuditPage() {
  const { t } = useTranslation();
  const p = useAuditParams();
  const { filters } = p;
  const audit = useAuditLog(filters);
  const rows = useMemo(() => audit.data?.pages.flatMap((pg) => pg.items) ?? [], [audit.data]);
  const fields = audit.isError ? apiErrorFields(audit.error) : [];
  const serverError = { from: fields.includes('from'), to: fields.includes('to') };
  const fieldError = serverError.from || serverError.to;
  const narrowed = Object.values(filters).some(Boolean);
  const title = t('audit.title');
  const clear = <button type="button" className="btn" onClick={p.clear}>{t('audit.filters.clear')}</button>;
  const count = audit.hasNextPage ? t('audit.page.countMore', { count: rows.length }) : t('audit.page.count', { count: rows.length });

  return (
    <div className="ct-page">
      <PageHeader crumbs={[t('nav.groups.system'), title]} title={title} description={t('audit.page.description')} />
      <AuditFilterBar key={`${filters.actor}|${filters.action}|${filters.from}|${filters.to}`} applied={filters} serverError={serverError} onApply={p.apply} onClear={p.clear} />
      <AuditQuick now={new Date()} applied={filters} onPatch={p.patch} />
      {!audit.isPending && !audit.isError && <p className="au-count">{count}</p>}
      {narrowed && !audit.isError && <FilterNotice label={t('audit.page.filterLabel')} count={rows.length} onClear={p.clear} />}
      {fieldError ? null : audit.isError ? (
        <LoadError onRetry={() => void audit.refetch()} />
      ) : (
        <AuditTable
          rows={rows}
          loading={audit.isPending}
          empty={{ title: t('audit.page.empty'), hint: t('audit.page.emptyHint'), action: narrowed ? clear : undefined }}
        />
      )}
      {audit.hasNextPage && (
        <button type="button" className="btn au-more" disabled={audit.isFetchingNextPage} onClick={() => void audit.fetchNextPage()}>
          {t('audit.page.more')}
        </button>
      )}
      {!audit.hasNextPage && rows.length > 0 && <p className="au-end">{t('audit.page.end')}</p>}
    </div>
  );
}
