import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import type { SyncResult as Result } from './directory.api';

export type SyncState = { kind: 'idle' } | { kind: 'running' } | { kind: 'done'; result: Result } | { kind: 'error'; key: string };

export function SyncNotice({ state, onRetry, onClose }: { state: SyncState; onRetry: () => void; onClose: () => void }) {
  const { t } = useTranslation();
  if (state.kind === 'done') {
    return (
      <div role="status" className="alert alert--ok dr-sync">
        <span className="dr-sync__text">
          {t('users.page.syncDone', { created: state.result.created, updated: state.result.updated })}
          {state.result.no_access > 0 && ` ${t('users.page.syncNoAccess', { count: state.result.no_access })}`}
          {state.result.reconcile === 'aborted' && ` ${t('users.page.syncReconcileAborted')}`}
        </span>
        <button type="button" className="sheet-close" aria-label={t('users.page.closeNotice')} onClick={onClose}>
          <Icon name="x" size={18} />
        </button>
      </div>
    );
  }
  if (state.kind !== 'error') return null;
  return (
    <div role="alert" className="alert alert--danger dr-sync">
      <span className="dr-sync__text">{t(state.key)}</span>
      <button type="button" className="btn btn--sm" onClick={onRetry}>
        {t('common.retry')}
      </button>
    </div>
  );
}
