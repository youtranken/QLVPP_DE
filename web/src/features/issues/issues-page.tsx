import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { matchesSearch } from '@/lib/search';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { vnYmNow } from '@/lib/ym';
import { ListMeta } from '@/ui/list-meta';
import { LoadError } from '@/ui/load-state';
import { MonthSwitcher } from '@/ui/month-switcher';
import { PageHeader } from '@/ui/page-header';
import { Toolbar } from '@/ui/toolbar';
import { monthOf } from '@/features/request/request-format';
import { IssueOneButton } from '@/features/stock/issue-one-button';
import { issuesQuery } from '@/features/stock/stock.api';
import { IssuesTable } from './issues-table';
import { useIssuesParams } from './use-issues-params';

const MAX_SEARCH = 100;

export function IssuesPage() {
  const { t } = useTranslation();
  const p = useIssuesParams();
  const [search, setSearch] = useUrlSearchBox(p.q, p.setQ);
  const q = useQuery(issuesQuery(p.ym));
  const all = useMemo(() => [...(q.data ?? [])].reverse(), [q.data]);
  const rows = useMemo(() => all.filter((r) => [r.item_name, r.item_name_en, r.recipient_name, r.note].some((x) => x != null && matchesSearch(x, p.q))), [all, p.q]);
  const units = rows.reduce((sum, r) => sum + r.qty, 0);
  const title = t('nav.issues');
  return (
    <div className="ct-page">
      <PageHeader
        crumbs={[t('nav.groups.stock'), title]}
        title={title}
        description={t('stock.issues.description')}
        primary={<IssueOneButton />}
        secondary={
          <Link className="btn" to="/admin/stock">
            {t('nav.stock')}
          </Link>
        }
      />
      <Toolbar
        lead={
          <MonthSwitcher
            value={p.ym}
            max={vnYmNow()}
            onChange={p.setYm}
            formatLabel={(v) => t('stock.issues.month', { month: monthOf(v), year: v.slice(0, 4) })}
            labels={{ group: t('stock.issues.monthNav'), prev: t('stock.issues.prevMonth'), next: t('stock.issues.nextMonth') }}
          />
        }
        search={{ value: search, onChange: setSearch, label: t('stock.issues.search'), placeholder: t('stock.issues.search'), maxLength: MAX_SEARCH }}
      >
        {q.isSuccess && (
          <ListMeta>
            {rows.length === all.length
              ? t('stock.issues.meta', { n: rows.length, units })
              : t('stock.issues.metaFiltered', { n: rows.length, total: all.length, units })}
          </ListMeta>
        )}
      </Toolbar>
      {q.isError ? <LoadError onRetry={() => void q.refetch()} /> : <IssuesTable rows={rows} loading={q.isPending} />}
    </div>
  );
}
