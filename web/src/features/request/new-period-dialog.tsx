import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { Dialog, DialogTitle } from '@/ui/dialog';
import type { CurrentPeriod } from './request.api';
import { monthOf, useRequestFormat } from './request-format';
import { readNewPeriodSeen, useNewPeriodSeen } from './use-new-period-seen';

interface Props {
  period: CurrentPeriod;
  // Đã có phiếu lưu cho kỳ này: không cần chào nữa
  saved: boolean;
  copyFromYm: string | null;
  onCopy: () => void;
}

// Chào một lần khi kỳ mới mở: một câu hạn đăng ký; phiếu tháng trước đã có ở dải nhận hàng trên trang
export function NewPeriodDialog({ period, saved, copyFromYm, onCopy }: Props) {
  const { t } = useTranslation();
  const me = useMe();
  const fmt = useRequestFormat();
  const { mark } = useNewPeriodSeen(me.sub, period.ym);
  const [open, setOpen] = useState(() => period.is_open && !saved && !readNewPeriodSeen(me.sub, period.ym));
  // Ghi "đã xem" ngay khi mở; có phiếu rồi thì ghi luôn để không bật lên về sau
  useEffect(() => {
    if (open || saved) mark();
  }, [open, saved, mark]);
  if (!open) return null;
  const month = monthOf(period.ym);
  return (
    <Dialog open onOpenChange={(o) => !o && setOpen(false)} className="sheet rq-dialog rq-newperiod" maxWidth={480}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('request.newPeriod.title', { month, date: fmt.lastDay(period.deadline) })}</DialogTitle>
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
