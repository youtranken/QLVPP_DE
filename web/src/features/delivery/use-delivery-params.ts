import { useCallback, useEffect } from 'react';
import { YM } from '@/lib/ym';
import { useUrlPatch } from '@/lib/use-url-patch';

// Chỉ kỳ đã khóa mới giao được: ?ym= sai mẫu hoặc vượt kỳ khóa gần nhất → thay URL, không gọi API với tháng sai
export function useDeliveryParams(lockedYm: string | undefined) {
  const [params, update] = useUrlPatch();
  const asked = params.get('ym');
  const ym = asked && lockedYm && YM.test(asked) && asked <= lockedYm ? asked : lockedYm;
  const showAll = params.get('all') === '1';


  const select = useCallback((id: string | null, replace = false) => update({ request: id }, replace), [update]);

  useEffect(() => {
    if (lockedYm && ym && asked !== null && asked !== ym) update({ ym }, true);
  }, [lockedYm, ym, asked, update]);

  return {
    ym,
    showAll,
    requestId: params.get('request'),
    setMonth: (next: string) => update({ ym: next, request: null }),
    setShowAll: (on: boolean) => update({ all: on ? '1' : null }, true),
    select,
  };
}
