import { useCallback, useEffect } from 'react';
import { useUrlPatch } from '@/lib/use-url-patch';
import { YM, shiftYm } from '@/lib/ym';

// Mặc định kỳ khóa gần nhất, trần là kỳ đang mở; ?ym= sai mẫu hoặc vượt trần → thay URL, không gọi API với tháng sai
export function useReportsParams(openYm: string | undefined) {
  const [params, update] = useUrlPatch();
  const asked = params.get('ym');
  const fallback = openYm && shiftYm(openYm, -1);
  const ym = asked && openYm && YM.test(asked) && asked <= openYm ? asked : fallback;

  const setMonth = useCallback((next: string, replace = false) => update({ ym: next }, replace), [update]);

  useEffect(() => {
    if (ym && asked !== null && asked !== ym) setMonth(ym, true);
  }, [ym, asked, setMonth]);

  return {
    ym: ym || undefined,
    setMonth: (next: string) => setMonth(next),
  };
}
