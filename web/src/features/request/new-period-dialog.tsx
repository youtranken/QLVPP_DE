import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { Dialog, DialogDescription, DialogTitle } from '@/ui/dialog';
import { receiveRows, receiveSummary } from './receive-rows';
import { useMyRequest, type CurrentPeriod } from './request.api';
import { monthOf, useRequestFormat } from './request-format';
import { readNewPeriodSeen, useNewPeriodSeen } from './use-new-period-seen';

interface Props {
  period: CurrentPeriod;
  // Đã có phiếu lưu cho kỳ này: không cần chào nữa
  saved: boolean;
  copyFromYm: string | null;
  onCopy: () => void;
}

// Chào một lần khi vào app sau khi kỳ mới mở: kỳ trước đã chốt, hạn kỳ này, lối tắt chép danh sách (NV4-PopupKyMoi)
export function NewPeriodDialog({ period, saved, copyFromYm, onCopy }: Props) {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const fmt = useRequestFormat();
  const prevYm = period.previous?.ym;
  const { mark } = useNewPeriodSeen(me.sub, period.ym);
  // Mọi người, kể cả không có phiếu tháng trước (khi đó không có dòng kỳ trước)
  const [open, setOpen] = useState(() => period.is_open && !saved && !readNewPeriodSeen(me.sub, period.ym));
  const previous = useMyRequest(open ? prevYm : undefined);
  // Ghi "đã xem" ngay khi mở; có phiếu rồi thì ghi luôn để không bật lên về sau
  useEffect(() => {
    if (open || saved) mark();
  }, [open, saved, mark]);
  if (!open) return null;
  const month = monthOf(period.ym);
  const prev = prevYm ? monthOf(prevYm) : null;
  const view = previous.data;
  const sum = view && view.lines.length > 0 ? receiveSummary(receiveRows(view, t, i18n.language)) : null;
  return (
    <Dialog open onOpenChange={(o) => !o && setOpen(false)} className="sheet rq-dialog rq-newperiod" maxWidth={560}>
      <div className="sheet-header">
        <div>
          {prev && <p className="rq-np-eyebrow">{t('request.newPeriod.eyebrow', { prev })}</p>}
          <DialogTitle className="sheet-title">{t('request.newPeriod.title', { month })}</DialogTitle>
        </div>
      </div>
      <div className="sheet-body">
        <DialogDescription>
          <Trans
            i18nKey={prev ? 'request.newPeriod.body' : 'request.newPeriod.bodyFirst'}
            values={{ prev, month, date: fmt.lastDay(period.deadline) }}
            components={{ b: <b /> }}
          />
        </DialogDescription>
        {sum && prevYm && (
          <div className="rq-np-prev">
            <span className="rq-recv-dot" aria-hidden="true" />
            <span>{t('request.newPeriod.prevLine', { prev, n: sum.total, done: sum.done })}</span>
            <Link to={`/history/${prevYm}`} onClick={() => setOpen(false)}>
              {t('request.newPeriod.viewPrev')}
            </Link>
          </div>
        )}
      </div>
      <div className="sheet-footer">
        {copyFromYm && (
          <button
            type="button"
            className="btn"
            onClick={() => {
              setOpen(false);
              onCopy();
            }}
          >
            {t('request.grid.copy', { month: monthOf(copyFromYm) })}
          </button>
        )}
        <button type="button" className="btn btn--primary" onClick={() => setOpen(false)}>
          {t('request.newPeriod.start', { month })}
        </button>
      </div>
    </Dialog>
  );
}
