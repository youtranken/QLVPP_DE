import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { vnSavedStamp } from '@/lib/format-time';
import { langOf, lockPhrase } from '@/lib/period-text';
import { OverlayPanel } from '@/ui/overlay-panel';
import { ItemThumb } from '@/ui/item-thumb';
import { Loading, LoadError } from '@/ui/load-state';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import type { LineView } from '@/features/request/request.api';
import { ReviewBlock } from './review-block';
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

// review: kỳ đã khóa thì dòng chờ duyệt có khối duyệt (server chỉ duyệt khi kỳ khóa)
function Line({ line, review }: { line: LineView; review?: { updatedAt: string; onDone: () => void } }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const paused = line.item?.active === false;
  const name = line.item ? fmt.name(line.item) : (line.custom_name ?? '');
  const unit = fmt.unit(line.item?.unit ?? line.custom_unit);
  return (
    <li className="rg-line">
      <ItemThumb fileId={line.item?.image_file_id ?? line.image_file_id} alt="" tone="g0" size={40} custom={!line.item} />
      <span className="rg-line__main">
        <b className={paused ? 'rg-line__name is-paused' : 'rg-line__name'}>{name}</b>
        {paused && <small className="rg-line__paused">{t('common.paused')}</small>}
        {!line.item && <small className="rg-line__custom">{t(line.review_status === 'accepted' ? 'summary.open.customStatus.accepted' : 'summary.open.customStatus.pending')}</small>}
      </span>
      <b className="num">{`${line.qty} ${unit}`}</b>
      {review && line.review_status === 'pending' && <ReviewBlock line={line} requestUpdatedAt={review.updatedAt} onDone={review.onDone} />}
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
  const stepped = useRef(false);
  useEffect(() => {
    if (!stepped.current) return;
    const a = document.activeElement;
    if (a !== document.body && !(a instanceof HTMLButtonElement && a.disabled)) return;
    const label = t(index === 0 ? 'summary.open.next' : 'summary.open.prev');
    document.querySelector<HTMLElement>(`.ovp [aria-label="${label}"]`)?.focus();
  }, [index, t]);
  const step = (next: number) => {
    stepped.current = true;
    onIndex(next);
  };
  // Nút ⋯ của dòng đang xem (sau ‹ › có thể là người khác người mở đầu)
  const returnToRow = () => {
    const opener = document.querySelector<HTMLElement>(`[data-view-id="${row.request_id}"] button`);
    opener?.focus();
    return !!opener;
  };
  const lock = deadline ? lockPhrase(deadline, langOf(i18n.language)) : '';
  const eyebrow = t(deadline ? 'summary.open.dialogMeta' : 'summary.open.dialogMetaLocked', { month: monthOf(ym), team: view.data?.team ?? t('common.empty') });
  return (
    <OverlayPanel
      open
      onClose={onClose}
      onCloseFocus={returnToRow}
      eyebrow={eyebrow}
      title={t('summary.open.dialogTitle', { name })}
      nav={{ index, total: rows.length, onStep: (dir) => step(index + dir), prevLabel: t('summary.open.prev'), nextLabel: t('summary.open.next') }}
    >
      <small className="rg-saved" aria-live="polite">
        {view.data ? t('summary.open.dialogSaved', { time: vnSavedStamp(row.saved_at ?? view.data.saved_at), kinds: lines.length, units }) : null}
      </small>
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
            <Line key={l.id} line={l} review={!deadline && view.data ? { updatedAt: view.data.updated_at, onDone: () => void view.refetch() } : undefined} />
          ))}
        </ul>
      )}
    </OverlayPanel>
  );
}
