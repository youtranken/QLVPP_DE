import { useMemo } from 'react';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { useUnregistered } from '@/features/summary/summary.api';
import type { RegSets } from './users-rows';

// Ai đã/chưa đăng ký kỳ đang mở, cùng tập người với Tổng hợp; chỉ đã/chưa, không món
export function useOpenRegistration() {
  const period = useCurrentPeriod();
  const ym = period.data?.ym;
  const query = useUnregistered(ym);
  const sets = useMemo<RegSets | null>(
    () => (query.data ? { unregistered: new Set(query.data.items.map((u) => u.sub)), registered: new Set(query.data.registered_subs ?? []) } : null),
    [query.data],
  );
  return {
    month: ym ? monthOf(ym) : null,
    sets,
    failed: period.isError || query.isError,
    retry: () => {
      if (period.isError) void period.refetch();
      else void query.refetch();
    },
  };
}
