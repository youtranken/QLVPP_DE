import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { FilterNotice } from '@/ui/filter-notice';
import { LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { Toolbar } from '@/ui/toolbar';
import { syncErrorKey } from './sync-errors';
import { syncDirectory } from './directory.api';
import { SyncNotice, type SyncState } from './sync-result';
import { UserDrawer } from './user-drawer';
import { UsersStats } from './users-stats';
import { UsersTable, type UserRow } from './users-table';
import { applyUsersView, departmentsOf, usersStats } from './users-rows';
import { useDirectoryUsers } from './use-all-users';
import { useUsersParams } from './use-users-params';
import './directory.m1.css';

const MAX_SEARCH = 200;

function useSync() {
  const { csrfToken } = useMe();
  const qc = useQueryClient();
  const [state, setState] = useState<SyncState>({ kind: 'idle' });
  const run = async () => {
    setState({ kind: 'running' });
    try {
      const result = await syncDirectory(csrfToken);
      setState({ kind: 'done', result });
      void qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e) {
      setState({ kind: 'error', key: syncErrorKey(e) });
    }
  };
  return { state, run: () => void run(), close: () => setState({ kind: 'idle' }) };
}

export function UsersPage() {
  const { t } = useTranslation();
  const p = useUsersParams();
  const [search, setSearch] = useUrlSearchBox(p.view.q, p.setQ);
  const dir = useDirectoryUsers(p.view.q);
  const sync = useSync();
  const [openSub, setOpenSub] = useState<string | null>(null);
  const shownUsers = useMemo(() => applyUsersView(dir.users, p.view, !dir.overflow), [dir.users, p.view, dir.overflow]);
  const rows = useMemo<UserRow[]>(() => shownUsers.map((u) => ({ ...u, id: u.sub })), [shownUsers]);
  const departments = useMemo(() => departmentsOf(dir.users), [dir.users]);
  const open = useCallback((u: UserRow) => setOpenSub(u.sub), []);
  const title = t('users.title');
  const header = (
    <PageHeader
      crumbs={[t('nav.groups.system'), title]}
      title={title}
      description={t('users.page.description')}
      actions={
        <button type="button" className="btn btn--primary" disabled={sync.state.kind === 'running'} aria-busy={sync.state.kind === 'running'} onClick={sync.run}>
          {t(sync.state.kind === 'running' ? 'users.page.syncing' : 'users.page.sync')}
        </button>
      }
    />
  );
  if (dir.failed) {
    return (
      <div className="ct-page">
        {header}
        <SyncNotice state={sync.state} onRetry={sync.run} onClose={sync.close} />
        <LoadError onRetry={dir.retry} />
      </div>
    );
  }

  const { filter } = p.view;
  const index = openSub ? rows.findIndex((r) => r.sub === openSub) : -1;
  const target = index >= 0 ? rows[index] : undefined;
  const step = (to: number) => setOpenSub(rows[to].sub);
  const narrowed = filter !== null || p.view.dept !== '' || p.view.q !== '';
  return (
    <div className="ct-page">
      {header}
      <SyncNotice state={sync.state} onRetry={sync.run} onClose={sync.close} />
      {!dir.loading && !dir.overflow && <UsersStats stats={usersStats(dir.users)} filter={filter} onFilter={p.toggleFilter} />}
      {dir.overflow && <p role="note" className="alert">{t('users.page.overflow')}</p>}
      <Toolbar search={{ value: search, onChange: setSearch, label: t('users.page.searchLabel'), placeholder: t('users.page.search'), maxLength: MAX_SEARCH }}>
        <label className="dr-dept">
          <span className="sr-only">{t('users.page.dept')}</span>
          <select value={p.view.dept} onChange={(e) => p.setDept(e.target.value)} aria-label={t('users.page.dept')}>
            <option value="">{t('users.page.allDepts')}</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </Toolbar>
      {!dir.loading && (
        <p className="dr-count">{t(dir.overflow ? 'users.page.shownPartial' : 'users.page.shown', { shown: rows.length, total: dir.users.length })}</p>
      )}
      {filter && <FilterNotice label={t(`users.stats.${filter}`)} count={rows.length} onClear={p.clearFilter} />}
      <UsersTable
        rows={rows}
        loading={dir.loading}
        activeId={target?.id}
        onOpen={open}
        empty={{
          title: t('users.page.empty'),
          hint: t('users.page.emptyHint'),
          action: narrowed ? (
            <button type="button" className="btn" onClick={() => { setSearch(''); p.clearAll(); }}>
              {t('common.filter.clear')}
            </button>
          ) : undefined,
        }}
      />
      {dir.hasMore && (
        <button type="button" className="btn dr-more" disabled={dir.fetchingMore} onClick={dir.fetchMore}>
          {t('users.page.more')}
        </button>
      )}
      {target && <UserDrawer user={target} position={index + 1} onPrev={index > 0 ? () => step(index - 1) : undefined} onNext={index < rows.length - 1 ? () => step(index + 1) : undefined} onClose={() => setOpenSub(null)} />}
    </div>
  );
}
