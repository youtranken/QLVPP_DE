import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { YM, shiftYm } from '@/lib/ym';

// Mặc định kỳ khóa gần nhất, trần là kỳ đang mở; ?ym= sai mẫu hoặc vượt trần → thay URL, không gọi API với tháng sai
export function useReportsParams(openYm: string | undefined) {
  const [params, setParams] = useSearchParams();
  const asked = params.get('ym');
  const fallback = openYm && shiftYm(openYm, -1);
  const ym = asked && openYm && YM.test(asked) && asked <= openYm ? asked : fallback;

  const setMonth = useCallback((next: string, replace = false) => setParams({ ym: next }, { replace }), [setParams]);

  useEffect(() => {
    if (ym && asked !== null && asked !== ym) setMonth(ym, true);
  }, [ym, asked, setMonth]);

  return {
    ym: ym || undefined,
    setMonth: (next: string) => setMonth(next),
    resetMonth: () => fallback && setMonth(fallback, true),
  };
}
