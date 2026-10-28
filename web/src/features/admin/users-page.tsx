import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { DataTable } from '@/ui/data-table';
import { LoadError } from '@/ui/load-state';
import { syncDirectory, useAdminUsers, type SyncResult } from '@/features/admin/admin.api';
import { syncErrorKey } from '@/features/admin/admin-errors';
import { useUsersColumns } from '@/features/admin/users-columns';
import '@/features/catalog/catalog.css';
import '@/features/admin/admin.css';

const SEARCH_DEBOUNCE_MS = 250;

type SyncState = { kind: 'idle' } | { kind: 'running' } | { kind: 'done'; result: SyncResult } | { kind: 'error'; key: string };

export function UsersPage() {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const search = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const users = useAdminUsers(search);
  const columns = useUsersColumns();
  const [sync, setSync] = useState<SyncState>({ kind: 'idle' });

  const runSync = async () => {
    setSync({ kind: 'running' });
    try {
      const result = await syncDirectory(csrfToken);
      setSync({ kind: 'done', result });
      void qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e) {
      setSync({ kind: 'error', key: syncErrorKey(e) });
    }
  };

  return (
    <div className="a-stack">
      <div className="a-toolbar">
        <input
          className="a-input admin-search"
          type="search"
          value={text}
          placeholder={t('users.page.search')}
          aria-label={t('users.page.search')}
          onChange={(e) => setText(e.target.value)}
        />
        <span className="sp" />
        <span className="admin-hint">{t('users.page.hint')}</span>
        <button type="button" className="btn btn--primary" disabled={sync.kind === 'running'} onClick={() => void runSync()}>
          {t(sync.kind === 'running' ? 'users.page.syncing' : 'users.page.sync')}
        </button>
      </div>
      {sync.kind === 'done' && (
        <p role="status" className="alert alert--ok">
          {t('users.page.syncDone', { created: sync.result.created, updated: sync.result.updated })}
        </p>
      )}
      {sync.kind === 'error' && (
        <p role="alert" className="alert alert--danger">
          {t(sync.key)}
        </p>
      )}
      {users.isError ? (
        <LoadError onRetry={() => void users.refetch()} />
      ) : (
        <section className="a-panel">
          <DataTable
            data={users.data?.pages.flatMap((p) => p.items) ?? []}
            columns={columns}
            loading={users.isPending}
            emptyText={t('users.page.empty')}
            rowClassName={(u) => (u.status === 'locked' ? 'is-inactive' : '')}
            stackOnMobile
          />
        </section>
      )}
      {users.hasNextPage && (
        <button type="button" className="btn admin-more" disabled={users.isFetchingNextPage} onClick={() => void users.fetchNextPage()}>
          {t('users.page.more')}
        </button>
      )}
    </div>
  );
}
