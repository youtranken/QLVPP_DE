import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { usePanelParam } from '@/lib/use-panel-param';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { FilterNotice } from '@/ui/filter-notice';
import { LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { Select } from '@/ui/select';
import { Toolbar } from '@/ui/toolbar';
import { syncErrorKey } from './sync-errors';
import { syncDirectory } from './directory.api';
import { SyncNotice, type SyncState } from './sync-result';
import { UserDrawer } from './user-drawer';
import { UsersStats } from './users-stats';
import { UsersTable, type UserRow } from './users-table';
import { applyUsersView, departmentsOf, regOf, usersStats } from './users-rows';
import { useOpenRegistration } from './use-open-registration';
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
  const reg = useOpenRegistration();
  const shownUsers = useMemo(() => applyUsersView(dir.users, p.view, !dir.overflow, reg.sets), [dir.users, p.view, dir.overflow, reg.sets]);
  const rows = useMemo<UserRow[]>(
    () => shownUsers.map((u) => ({ ...u, id: u.sub, reg: reg.sets ? regOf(u, reg.sets) : undefined })),
    [shownUsers, reg.sets],
  );
  const order = useMemo(() => rows.map((r) => r.sub), [rows]);
  const departments = useMemo(() => departmentsOf(dir.users), [dir.users]);
  // Danh bạ còn trang chưa tải thì chưa kết luận người lạ: chỉ gỡ ?person= khi đã có đủ danh sách
  const known = (sub: string) => (dir.users.some((u) => u.sub === sub) ? true : dir.loading || dir.hasMore ? undefined : false);
  const panel = usePanelParam('person', { order, known });
  const open = (u: UserRow) => panel.open(u.sub);
  const title = t('users.title');
  const header = (
    <PageHeader
      crumbs={[t('nav.groups.system'), title]}
      title={title}
      description={t('users.page.description')}
      note={<span className="dr-auto">{t('users.page.autoSync')}</span>}
      primary={
        <button type="button" className="btn btn--primary" title={t('users.page.hint')} disabled={sync.state.kind === 'running'} aria-busy={sync.state.kind === 'running'} onClick={sync.run}>
          {t(sync.state.kind === 'running' ? 'users.page.syncing' : 'users.page.sync')}
        </button>
      }
    />
  );
  if (dir.failed) {
    return (
      <div className="ct-page dr-page">
        {header}
        <SyncNotice state={sync.state} onRetry={sync.run} onClose={sync.close} />
        <LoadError onRetry={dir.retry} />
      </div>
    );
  }

  const { filter } = p.view;
  const openUser = panel.id ? dir.users.find((u) => u.sub === panel.id) : undefined;
  const target: UserRow | undefined = openUser && { ...openUser, id: openUser.sub, reg: reg.sets ? regOf(openUser, reg.sets) : undefined };
  const narrowed = filter !== null || p.view.reg !== null || p.view.dept !== '' || p.view.q !== '';
  const regCard =
    reg.month === null ? null : { month: reg.month, count: reg.sets ? reg.sets.unregistered.size : null, pressed: p.view.reg === 'no', onClick: () => p.toggleReg('no') };
  return (
    <div className="ct-page dr-page">
      {header}
      <SyncNotice state={sync.state} onRetry={sync.run} onClose={sync.close} />
      {!dir.loading && !dir.overflow && <UsersStats stats={usersStats(dir.users)} filter={filter} onFilter={p.toggleFilter} reg={regCard} />}
      {reg.failed && <LoadError onRetry={reg.retry} />}
      {dir.overflow && <p role="note" className="alert">{t('users.page.overflow')}</p>}
      <Toolbar search={{ value: search, onChange: setSearch, label: t('users.page.searchLabel'), placeholder: t('users.page.search'), maxLength: MAX_SEARCH }}>
        <Select
          label={t('users.page.dept')}
          hideLabel
          value={p.view.dept}
          onChange={p.setDept}
          options={[{ value: '', label: t('users.page.allDepts') }, ...departments.map((d) => ({ value: d, label: d }))]}
        />
      </Toolbar>
      {!dir.loading && (
        <p className="dr-count">{t(dir.overflow ? 'users.page.shownPartial' : 'users.page.shown', { shown: rows.length, total: dir.users.length })}</p>
      )}
      {filter && <FilterNotice label={t(`users.stats.${filter}`)} count={rows.length} onClear={p.clearFilter} />}
      {p.view.reg && reg.month !== null && <FilterNotice label={t(p.view.reg === 'yes' ? 'users.reg.yes' : 'users.reg.no', { month: reg.month })} count={rows.length} onClear={p.clearReg} />}
      <UsersTable
        rows={rows}
        regMonth={reg.month}
        loading={dir.loading || (p.view.reg !== null && !reg.sets && !reg.failed)}
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
      {target && <UserDrawer user={target} nav={{ index: panel.index, total: panel.total, onStep: panel.step }} onClose={panel.close} />}
    </div>
  );
}
