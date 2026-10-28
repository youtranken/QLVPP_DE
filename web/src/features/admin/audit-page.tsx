import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/ui/data-table';
import { LoadError } from '@/ui/load-state';
import { NO_FILTERS, useAuditLog, type AuditFilters } from '@/features/admin/admin.api';
import { AuditFilterBar } from '@/features/admin/audit-filters';
import { useAuditColumns } from '@/features/admin/audit-columns';
import '@/features/admin/admin.css';

export function AuditPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AuditFilters>(NO_FILTERS);
  const audit = useAuditLog(filters);
  const columns = useAuditColumns();

  return (
    <div className="a-stack">
      <AuditFilterBar onApply={setFilters} />
      {audit.isError ? (
        <LoadError onRetry={() => void audit.refetch()} />
      ) : (
        <section className="a-panel">
          <DataTable
            data={audit.data?.pages.flatMap((p) => p.items) ?? []}
            columns={columns}
            loading={audit.isPending}
            emptyText={t('audit.page.empty')}
            stackOnMobile
          />
        </section>
      )}
      {audit.hasNextPage && (
        <button type="button" className="btn admin-more" disabled={audit.isFetchingNextPage} onClick={() => void audit.fetchNextPage()}>
          {t('audit.page.more')}
        </button>
      )}
    </div>
  );
}
