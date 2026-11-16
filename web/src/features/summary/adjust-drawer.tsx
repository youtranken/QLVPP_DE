import { useId, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { vnSavedStamp } from '@/lib/format-time';
import { DialogClose } from '@/ui/dialog';
import { OverlayPanel, type PanelNav } from '@/ui/overlay-panel';
import { Loading, LoadError } from '@/ui/load-state';
import { monthOf } from '@/features/request/request-format';
import { AdjustLines } from './adjust-lines';
import { useAdjust, type Adjust } from './use-adjust';
import type { AdjustReason, AdminRequestView } from './summary.api';
import { useDisabledReason } from '@/ui/disabled-reason';

function Context({ view, a }: { view: AdminRequestView; a: Adjust }) {
  const { t } = useTranslation();
  const kept = view.lines.filter((l) => !a.removed.includes(l.id));
  const before = view.lines.reduce((s, l) => s + l.qty, 0);
  const after = kept.reduce((s, l) => s + a.qtyOf(l), 0);
  return (
    <div className="aj-head__text">
      <small className="drawer-eyebrow">
        {t('summary.adjust.eyebrow', {
          month: monthOf(view.period_ym),
          year: view.period_ym.slice(0, 4),
          department: view.department ?? t('summary.adjust.noDepartment'),
        })}
      </small>
      <small className="aj-head__sub">{t('summary.adjust.subtitle', { n: kept.length, u: before, after })}</small>
      <span className="aj-head__tags">
        <span className={view.is_open ? 'tag tag--ok' : 'tag tag--dark'}>{t(view.is_open ? 'summary.adjust.open' : 'summary.adjust.locked')}</span>
        {view.user_status !== 'active' && <span className="tag tag--outline">{t('summary.adjust.leftCompany')}</span>}
      </span>
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

function Footer({ a, formId }: { a: Adjust; formId: string }) {
  const { t } = useTranslation();
  const note = a.changes > 0 ? t('summary.adjust.changes', { n: a.changes }) : a.view && t('summary.adjust.savedAt', { at: vnSavedStamp(a.view.updated_at) });
  const reason = useDisabledReason(!a.canSave && a.changes === 0 && !a.saving ? t('common.disabledReason.noChanges') : null);
  return (
    <>
      <small className="drawer-note">{note}</small>
      <DialogClose asChild>
        <button type="button" className="btn btn--ghost" disabled={a.saving}>
          {t('common.cancel')}
        </button>
      </DialogClose>
      <button type="submit" form={formId} className="btn btn--primary" disabled={!a.canSave} aria-describedby={reason.describedBy}>
        {a.saving ? t('summary.adjust.saving') : t('summary.adjust.save')}
      </button>
      {reason.node}
    </>
  );
}

export function AdjustDrawer({ requestId, presetReason, onClose, nav }: {
  requestId: string;
  // Mở từ lọc người đã nghỉ (?left=1): dòng giảm chọn sẵn lý do "Người đã nghỉ"
  presetReason?: AdjustReason;
  onClose: () => void;
  nav?: Omit<PanelNav, 'prevLabel' | 'nextLabel'>;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const a = useAdjust(requestId, onClose, presetReason);
  const view = a.view;
  // Phiếu Hành chính đã bỏ hết dòng sau khóa sổ vẫn giữ (vẫn tính đã đăng ký) nhưng không còn gì để sửa
  const removedAll = !!view && !view.is_open && view.lines.length === 0;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    a.save();
  };
  return (
    <OverlayPanel
      open
      onClose={onClose}
      title={view ? t('summary.adjust.title', { name: view.full_name ?? view.user_sub }) : t('summary.adjust.loading')}
      dirty={a.dirty}
      saving={a.saving}
      nav={nav && { ...nav, prevLabel: t('summary.adjust.prev'), nextLabel: t('summary.adjust.next') }}
      footer={<Footer a={a} formId={formId} />}
    >
      <form id={formId} className="aj-form" onSubmit={submit} noValidate>
        {view && <Context view={view} a={a} />}
        {view && !view.is_open && !removedAll && <p className="alert alert--warn">{t('summary.adjust.lockedWarn')}</p>}
        <Blocks a={a} />
        {a.query.isError && <LoadError onRetry={a.reload} />}
        {a.query.isPending && <Loading />}
        {removedAll && <p className="sm-muted">{t('summary.adjust.removedAll')}</p>}
        {view && !removedAll && <AdjustLines a={a} view={view} />}
      </form>
    </OverlayPanel>
  );
}
