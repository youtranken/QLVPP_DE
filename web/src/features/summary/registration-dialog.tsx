import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { vnSavedStamp } from '@/lib/format-time';
import { langOf, lockPhrase } from '@/lib/period-text';
import { Dialog, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { ItemThumb } from '@/ui/item-thumb';
import { Loading, LoadError } from '@/ui/load-state';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import type { LineView } from '@/features/request/request.api';
import { useRegistration, type RegistrationRow } from './summary.api';

export type RegistrationTarget = Pick<RegistrationRow, 'request_id' | 'user_sub' | 'full_name' | 'email'> & { saved_at?: string };

interface Props {
  ym: string;
  // Có hạn = kỳ còn mở (chỉ xem, nhắc hạn); null = kỳ đã khóa
  deadline: string | null;
  rows: RegistrationTarget[];
  index: number;
  onIndex: (next: number) => void;
  onClose: () => void;
}

function Line({ line }: { line: LineView }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const paused = line.item?.active === false;
  const name = line.item ? fmt.name(line.item) : (line.custom_name ?? '');
  const unit = fmt.unit(line.item?.unit ?? line.custom_unit);
  return (
    <li className="rg-line">
      <ItemThumb fileId={line.item?.image_file_id ?? line.image_file_id} alt="" tone="g0" size={40} />
      <span className="rg-line__main">
        <b className={paused ? 'rg-line__name is-paused' : 'rg-line__name'}>{name}</b>
        {paused && <small className="rg-line__paused">{t('common.paused')}</small>}
        {!line.item && <small className="rg-line__custom">{t('summary.open.customLine')}</small>}
      </span>
      <b className="num">{`${line.qty} ${unit}`}</b>
    </li>
  );
}

export function RegistrationDialog({ ym, deadline, rows, index, onIndex, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const row = rows[index];
  const view = useRegistration(ym, row.request_id);
  const name = row.full_name ?? row.email ?? row.user_sub;
  const lines = view.data?.lines.filter((l) => l.review_status !== 'rejected') ?? [];
  const units = lines.reduce((sum, l) => sum + l.qty, 0);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const stepped = useRef(false);
  useEffect(() => {
    if (!stepped.current) return;
    const a = document.activeElement;
    if (a === document.body || (a instanceof HTMLButtonElement && a.disabled)) (index === 0 ? nextRef : prevRef).current?.focus();
  }, [index]);
  const step = (next: number) => {
    stepped.current = true;
    onIndex(next);
  };
  const returnToRow = () => {
    const opener = document.querySelector<HTMLElement>(`[data-view-id="${row.request_id}"]`);
    opener?.focus();
    return !!opener;
  };
  const lock = deadline ? lockPhrase(deadline, langOf(i18n.language)) : '';
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} maxWidth={560} onCloseFocus={returnToRow}>
      <div className="sheet-header rg-head">
        <div className="rg-head__text">
          <small>{t(deadline ? 'summary.open.dialogMeta' : 'summary.open.dialogMetaLocked', { month: monthOf(ym), team: view.data?.team ?? t('common.empty') })}</small>
          <DialogTitle className="sheet-title">{t('summary.open.dialogTitle', { name })}</DialogTitle>
          <small aria-live="polite">{view.data ? t('summary.open.dialogSaved', { time: vnSavedStamp(row.saved_at ?? view.data.updated_at), kinds: lines.length, units }) : null}</small>
        </div>
        <button type="button" ref={prevRef} className="rg-step" aria-label={t('summary.open.prev')} disabled={index === 0} onClick={() => step(index - 1)}>
          ‹
        </button>
        <button type="button" ref={nextRef} className="rg-step" aria-label={t('summary.open.next')} disabled={index >= rows.length - 1} onClick={() => step(index + 1)}>
          ›
        </button>
        <DialogCloseButton />
      </div>
      <div className="sheet-body">
        {deadline && (
          <p className="alert" role="status">
            {t('summary.open.dialogNote', { lockPhrase: lock })}
          </p>
        )}
        {view.isError ? (
          <LoadError onRetry={() => void view.refetch()} />
        ) : view.isPending ? (
          <Loading />
        ) : (
          <ul className="rg-lines" aria-label={t('summary.open.lines')}>
            {lines.map((l) => (
              <Line key={l.id} line={l} />
            ))}
          </ul>
        )}
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Dialog>
  );
}
