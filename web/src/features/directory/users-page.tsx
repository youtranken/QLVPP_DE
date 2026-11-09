import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SyncStatusLine } from './sync-status';
import { SYNC_STATUS_KEY } from './use-sync-status';
import { UsersStats } from './users-stats';
import { UsersTable, type UserRow } from './users-table';
import { applyUsersView, departmentsOf, regOf, usersStats } from './users-rows';
import { useOpenRegistration } from './use-open-registration';
import { useDeletedUsers, useDirectoryUsers } from './use-all-users';
import { useUsersParams } from './use-users-params';
import './directory.m1.css';

const MAX_SEARCH = 200;
const DELETED = 'deleted' as const;

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
    } finally {
      void qc.invalidateQueries({ queryKey: SYNC_STATUS_KEY });
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
  const showDeleted = p.view.filter === DELETED;
  const deleted = useDeletedUsers(showDeleted);
  const reg = useOpenRegistration();
  // Bộ lọc Đã xoá đọc từ danh sách riêng (ẩn mặc định); tìm kiếm luôn tại chỗ vì danh sách này tải hết
  const list = showDeleted ? deleted.users : dir.users;
  const shownUsers = useMemo(() => applyUsersView(list, p.view, showDeleted || !dir.overflow, reg.sets), [list, p.view, showDeleted, dir.overflow, reg.sets]);
  const rows = useMemo<UserRow[]>(
    () => shownUsers.map((u) => ({ ...u, id: u.sub, reg: reg.sets ? regOf(u, reg.sets) : undefined })),
    [shownUsers, reg.sets],
  );
  const order = useMemo(() => rows.map((r) => r.sub), [rows]);
  const departments = useMemo(() => departmentsOf(list), [list]);
  // Danh bạ còn trang chưa tải thì chưa kết luận người lạ: chỉ gỡ ?person= khi đã có đủ danh sách
  const known = (sub: string) => (list.some((u) => u.sub === sub) ? true : dir.loading || deleted.loading || (!showDeleted && dir.hasMore) ? undefined : false);
  const panel = usePanelParam('person', { order, known });
  // onOpen giữ nguyên qua các lần vẽ: cột bảng memo theo nó, đổi mỗi lần vẽ thì bảng dựng lại (dữ liệu đăng ký về sau làm nút tên đang bấm bị thay)
  const openPanel = useRef(panel.open);
  useEffect(() => {
    openPanel.current = panel.open;
  });
  const open = useCallback((u: UserRow) => openPanel.current(u.sub), []);
  const title = t('users.title');
  const header = (
    <PageHeader
      crumbs={[t('nav.groups.system'), title]}
      title={title}
      description={t('users.page.description')}
      note={<SyncStatusLine />}
      primary={
        <button type="button" className="btn btn--primary" title={t('users.page.hint')} disabled={sync.state.kind === 'running'} aria-busy={sync.state.kind === 'running'} onClick={sync.run}>
          {t(sync.state.kind === 'running' ? 'users.page.syncing' : 'users.page.sync')}
        </button>
      }
    />
  );
  if (dir.failed || (showDeleted && deleted.failed)) {
    return (
      <div className="ct-page dr-page">
        {header}
        <SyncNotice state={sync.state} onRetry={sync.run} onClose={sync.close} />
        <LoadError onRetry={dir.failed ? dir.retry : deleted.retry} />
      </div>
    );
  }

  const { filter } = p.view;
  const openUser = panel.id ? list.find((u) => u.sub === panel.id) : undefined;
  const target: UserRow | undefined = openUser && { ...openUser, id: openUser.sub, reg: reg.sets ? regOf(openUser, reg.sets) : undefined };
  const narrowed = filter !== null || p.view.reg !== null || p.view.dept !== '' || p.view.q !== '';
  const regCard =
    reg.month === null ? null : { month: reg.month, count: reg.sets ? reg.sets.unregistered.size : null, pressed: p.view.reg === 'no', onClick: () => p.toggleReg('no') };
  return (
    <div className="ct-page dr-page">
      {header}
      <SyncNotice state={sync.state} onRetry={sync.run} onClose={sync.close} />
      {!dir.loading && !dir.overflow && <UsersStats stats={usersStats(dir.users)} filter={filter === DELETED ? null : filter} onFilter={p.toggleFilter} reg={regCard} />}
      {reg.failed && <LoadError onRetry={reg.retry} />}
      {dir.overflow && !showDeleted && <p role="note" className="alert">{t('users.page.overflow')}</p>}
      <Toolbar search={{ value: search, onChange: setSearch, label: t('users.page.searchLabel'), placeholder: t('users.page.search'), maxLength: MAX_SEARCH }}>
        <Select
          label={t('users.page.dept')}
          hideLabel
          value={p.view.dept}
          onChange={p.setDept}
          options={[{ value: '', label: t('users.page.allDepts') }, ...departments.map((d) => ({ value: d, label: d }))]}
        />
        <Select
          label={t('users.page.viewLabel')}
          hideLabel
          value={showDeleted ? DELETED : ''}
          onChange={(v) => (v === DELETED ? p.setFilter(DELETED) : showDeleted && p.clearFilter())}
          options={[
            { value: '', label: t('users.page.viewCurrent') },
            { value: DELETED, label: t('users.page.viewDeleted') },
          ]}
        />
      </Toolbar>
      {!dir.loading && (
        <p className="dr-count">{t(dir.overflow && !showDeleted ? 'users.page.shownPartial' : 'users.page.shown', { shown: rows.length, total: list.length })}</p>
      )}
      {filter && <FilterNotice label={t(`users.stats.${filter}`)} count={rows.length} onClear={p.clearFilter} />}
      {p.view.reg && reg.month !== null && <FilterNotice label={t(p.view.reg === 'yes' ? 'users.reg.yes' : 'users.reg.no', { month: reg.month })} count={rows.length} onClear={p.clearReg} />}
      <UsersTable
        rows={rows}
        regMonth={reg.month}
        loading={dir.loading || deleted.loading || (p.view.reg !== null && !reg.sets && !reg.failed)}
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
      {dir.hasMore && !showDeleted && (
        <button type="button" className="btn dr-more" disabled={dir.fetchingMore} onClick={dir.fetchMore}>
          {t('users.page.more')}
        </button>
      )}
      {target && <UserDrawer user={target} nav={{ index: panel.index, total: panel.total, onStep: panel.step }} onClose={panel.close} />}
    </div>
  );
}
