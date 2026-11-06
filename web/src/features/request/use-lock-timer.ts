import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CURRENT_PERIOD_KEY, currentPeriodQuery } from './request.api';

// setTimeout tràn ở 2^31-1 ms: hạn xa hơn thì hẹn từng chặng
const MAX_DELAY = 2 ** 31 - 1;

// Qua giờ khóa thì kỳ mở đổi: tải lại tại deadline + 1 s theo deadline server trả
export function useLockTimer() {
  const qc = useQueryClient();
  const deadline = useQuery(currentPeriodQuery()).data?.deadline;
  useEffect(() => {
    if (!deadline) return;
    const fireAt = new Date(deadline).getTime() + 1000;
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => {
      const left = fireAt - Date.now();
      if (left > MAX_DELAY) timer = setTimeout(arm, MAX_DELAY);
      else timer = setTimeout(() => void qc.invalidateQueries({ queryKey: CURRENT_PERIOD_KEY }), Math.max(left, 0));
    };
    arm();
    return () => clearTimeout(timer);
  }, [deadline, qc]);
}
