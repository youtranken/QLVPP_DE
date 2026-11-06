import { useCallback, useEffect } from 'react';
import { useUrlPatch } from '@/lib/use-url-patch';
import { YM, lockedYm } from '@/lib/ym';

// Chỉ xem kỳ đã khóa: mặc định và trần là kỳ khóa gần nhất; ?ym= sai mẫu, là kỳ mở hoặc tương lai → thay URL, không gọi API với tháng đó
export function useReportsParams(openYm: string | undefined) {
  const [params, update] = useUrlPatch();
  const asked = params.get('ym');
  const ceiling = openYm && lockedYm(openYm);
  const ym = asked && openYm && YM.test(asked) && asked < openYm ? asked : ceiling;

  const setMonth = useCallback((next: string, replace = false) => update({ ym: next }, replace), [update]);

  useEffect(() => {
    if (ym && asked !== null && asked !== ym) setMonth(ym, true);
  }, [ym, asked, setMonth]);

  return {
    ym: ym || undefined,
    setMonth: (next: string) => setMonth(next),
  };
}
