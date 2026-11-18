import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { noteLength } from '@/lib/note-text';
import { SelectBox } from '@/ui/data-table-row';
import { DialogClose } from '@/ui/dialog';
import { useDisabledReason } from '@/ui/disabled-reason';
import { FormField } from '@/ui/form-field';
import { Loading, LoadError } from '@/ui/load-state';
import { OverlayPanel, type PanelNav } from '@/ui/overlay-panel';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { AdjustPickRow } from './adjust-pick-row';
import { previewText } from './adjust-preview';
import { reasonChoices } from './adjust-reasons';
import type { AdjustReason } from './summary.api';
import { NOTE_MAX, useAdjustDialog, type AdjustDialogState } from './use-adjust-dialog';

function ReasonPicker({ a }: { a: AdjustDialogState }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="ajd-why">
      <span id={`${id}-label`} className="aj-why__label">
        {t('summary.adjust.reasonLabel')}
      </span>
      <div role="radiogroup" aria-labelledby={`${id}-label`} className="aj-why__chips">
        {reasonChoices({ ownerLeft: a.ownerLeft }).map((code) => (
          <label key={code} className="aj-chip">
            <input type="radio" name={`${id}-reason`} checked={a.reason === code} onChange={() => a.setReason(code)} />
            <span>{t(`adjustReason.${code}`)}</span>
          </label>
        ))}
      </div>
      <FormField
        label={t('summary.adjust.lineNote')}
        required={a.reason === 'other'}
        hint={t('summary.adjust.otherHint')}
        error={a.missingNote ? t('summary.adjust.otherRequired') : undefined}
        counter={{ value: noteLength(a.note), max: NOTE_MAX }}
      >
        {(control) => <textarea {...control} className="aj-why__note" rows={2} value={a.note} onChange={(e) => a.setNote(e.target.value)} />}
      </FormField>
    </div>
  );
}

function PickAll({ a }: { a: AdjustDialogState }) {
  const { t } = useTranslation();
  const id = useId();
  if (a.pickable === 0) return null;
  const all = a.count === a.pickable;
  return (
    <div className="ajd-all">
      <SelectBox id={id} checked={all} indeterminate={a.count > 0 && !all} label={t('summary.adjust.pickAll')} onChange={a.toggleAll} />
      <label htmlFor={id} aria-hidden="true">
        {t('summary.adjust.pickAll')}
      </label>
    </div>
  );
}

function Footer({ a }: { a: AdjustDialogState }) {
  const { t } = useTranslation();
  const lock = useDisabledReason(a.saving ? null : a.blocked);
  return (
    <>
      {lock.node}
      <DialogClose asChild>
        <button type="button" className="btn btn--ghost" disabled={a.saving}>
          {t('common.cancel')}
        </button>
      </DialogClose>
      <button type="button" className="btn btn--primary" disabled={!!a.blocked || a.saving} aria-describedby={lock.describedBy} onClick={() => void a.save()}>
        {a.saving ? t('summary.adjust.saving') : t('summary.adjust.saveCount', { count: a.count })}
      </button>
    </>
  );
}

export function AdjustDialog({ requestId, presetReason, onClose, onSaved, nav }: {
  requestId: string;
  // Mở từ lọc người đã nghỉ (?left=1): chọn sẵn lý do "Người đã nghỉ"
  presetReason?: AdjustReason;
  onClose: () => void;
  // Gọi ngay khi lưu thành công, kèm lời hứa nạp lại dữ liệu (hộp Giao chụp lại số khi nạp xong)
  onSaved?: (refreshed: Promise<unknown>) => void;
  nav?: Omit<PanelNav, 'prevLabel' | 'nextLabel'>;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const a = useAdjustDialog(requestId, onClose, presetReason, onSaved);
  const view = a.view;
  const preview = view ? previewText(t, fmt.unit, view, a.picks, a.reason, a.note) : null;
  return (
    <OverlayPanel
      open
      onClose={onClose}
      title={view ? t('summary.adjust.title', { name: view.full_name ?? view.user_sub }) : t('summary.adjust.loading')}
      eyebrow={view ? t('summary.adjust.eyebrow', { month: monthOf(view.period_ym), year: view.period_ym.slice(0, 4), department: view.department ?? t('summary.adjust.noDepartment') }) : undefined}
      dirty={a.dirty}
      saving={a.saving}
      nav={nav && { ...nav, prevLabel: t('summary.adjust.prev'), nextLabel: t('summary.adjust.next') }}
      footer={<Footer a={a} />}
    >
      <div className="ajd">
        {a.stale && (
          <div role="alert" className="alert alert--warn">
            <span>{t('summary.adjust.stale')}</span>
            <button type="button" className="btn btn--sm" onClick={() => void a.reloadLatest()}>
              {t('summary.adjust.reload')}
            </button>
          </div>
        )}
        {a.errors.block && (
          <p role="alert" className="alert alert--danger">
            {a.errors.block}
          </p>
        )}
        {a.query.isError && <LoadError onRetry={() => void a.query.refetch()} />}
        {a.query.isPending && <Loading />}
        {view && (
          <>
            <p className="ajd__hint">{t('summary.adjust.pickHint')}</p>
            <PickAll a={a} />
            <ul className="ajd__lines" aria-label={t('summary.adjust.lines')}>
              {view.lines.map((l) => (
                <AdjustPickRow key={l.id} line={l} pick={a.picks[l.id]} error={a.errors.lines?.[l.id]} sentAt={a.sentAt} onToggle={(p) => a.toggle(l.id, p)} onPick={(p) => a.setPick(l.id, p)} />
              ))}
            </ul>
            <ReasonPicker a={a} />
            {preview && (
              <div className="ajd__preview">
                <small>{t('summary.adjust.previewLabel')}</small>
                <p>{preview}</p>
              </div>
            )}
          </>
        )}
      </div>
    </OverlayPanel>
  );
}
