import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatTime } from '@/lib/format-time';
import { Drawer, DrawerClose, DrawerTitle } from '@/ui/drawer';
import { FormField } from '@/ui/form-field';
import { Icon } from '@/ui/icon';
import { Loading, LoadError } from '@/ui/load-state';
import { monthOf } from '@/features/request/request-format';
import { AdjustLines } from './adjust-lines';
import { useAdjust, type Adjust } from './use-adjust';
import type { AdminRequestView } from './summary.api';

const REASON_MAX = 500;

function Header({ view }: { view: AdminRequestView | undefined }) {
  const { t } = useTranslation();
  return (
    <div className="drawer-header aj-head">
      <div className="aj-head__text">
        {view && (
          <small className="drawer-eyebrow">
            {t('summary.adjust.eyebrow', {
              month: monthOf(view.period_ym),
              year: view.period_ym.slice(0, 4),
              department: view.department ?? t('summary.adjust.noDepartment'),
            })}
          </small>
        )}
        <DrawerTitle className="sheet-title">
          {view ? t('summary.adjust.title', { name: view.full_name ?? view.user_sub }) : t('summary.adjust.loading')}
        </DrawerTitle>
        {view && (
          <span className="aj-head__tags">
            <span className={view.is_open ? 'tag tag--ok' : 'tag tag--dark'}>
              {t(view.is_open ? 'summary.adjust.open' : 'summary.adjust.locked')}
            </span>
            {view.user_status !== 'active' && <span className="tag tag--outline">{t('summary.adjust.leftCompany')}</span>}
          </span>
        )}
      </div>
      <DrawerClose asChild>
        <button type="button" className="sheet-close" aria-label={t('common.close')}>
          <Icon name="x" />
        </button>
      </DrawerClose>
    </div>
  );
}

function Blocks({ a }: { a: Adjust }) {
  const { t } = useTranslation();
  return (
    <>
      {a.stale && (
        <div role="alert" className="alert alert--warn aj-block">
          <span>{t('summary.adjust.stale')}</span>
          <button type="button" className="btn btn--sm" onClick={a.reloadLatest}>
            {t('summary.adjust.reload')}
          </button>
        </div>
      )}
      {a.reloaded && (
        <p role="status" className="alert alert--warn">
          {t('summary.adjust.reloaded')}
        </p>
      )}
      {a.errors.block && (
        <p role="alert" className="alert alert--danger">
          {a.errors.block}
        </p>
      )}
    </>
  );
}

function ReasonField({ a }: { a: Adjust }) {
  const { t } = useTranslation();
  return (
    <FormField
      label={t('summary.adjust.reason')}
      required={a.locked}
      error={a.errors.reason}
      hint={t(a.locked ? 'summary.adjust.reasonLocked' : 'summary.adjust.reasonOpen')}
      counter={{ value: a.reason.length, max: REASON_MAX }}
    >
      {(control) => (
        <textarea
          {...control}
          className="aj-reason"
          value={a.reason}
          maxLength={REASON_MAX}
          placeholder={t('summary.adjust.reasonPlaceholder')}
          onChange={(e) => a.setReason(e.target.value)}
        />
      )}
    </FormField>
  );
}

function Footer({ a }: { a: Adjust }) {
  const { t } = useTranslation();
  const at = useFormatTime();
  const note = a.changes > 0 ? t('summary.adjust.changes', { n: a.changes }) : a.view && t('summary.adjust.savedAt', { at: at(a.view.updated_at) });
  return (
    <div className="drawer-footer">
      <small className="drawer-note">{note}</small>
      <DrawerClose asChild>
        <button type="button" className="btn btn--ghost" disabled={a.saving}>
          {t('summary.adjust.cancel')}
        </button>
      </DrawerClose>
      <button type="submit" className="btn btn--primary" disabled={!a.canSave}>
        {a.saving ? t('summary.adjust.saving') : t('summary.adjust.save')}
      </button>
    </div>
  );
}

export function AdjustDrawer({ requestId, onClose, onPrev, onNext }: {
  requestId: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { t } = useTranslation();
  const a = useAdjust(requestId, onClose);
  const view = a.view;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    a.save();
  };
  return (
    <Drawer
      open
      onOpenChange={(o) => !o && onClose()}
      dirty={a.dirty}
      dismissible={!a.saving}
      onPrev={a.saving ? undefined : onPrev}
      onNext={a.saving ? undefined : onNext}
    >
      <Header view={view} />
      <form className="aj-form" onSubmit={submit} noValidate>
        <div className="drawer-body">
          {view && !view.is_open && <p className="alert alert--warn">{t('summary.adjust.lockedWarn')}</p>}
          <Blocks a={a} />
          {a.query.isError && <LoadError onRetry={a.reload} />}
          {a.query.isPending && <Loading />}
          {view && <AdjustLines a={a} view={view} />}
          {view && <ReasonField a={a} />}
        </div>
        <Footer a={a} />
      </form>
    </Drawer>
  );
}
