import { useEffect } from 'react';
import { useUrlPatch } from '@/lib/use-url-patch';
import type { CancelReason } from './backlog.api';

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;

// ?ym= tháng nợ, ?q= tìm, ?left=1 chỉ người đã nghỉ (đến từ nhắc ở Kỳ tháng, Hủy nợ chọn sẵn "Người đã nghỉ").
// ?by= và ?filter= của bản cũ bị gỡ khỏi URL; filter=left cũ thành left=1
export function useBacklogParams() {
  const [params, update] = useUrlPatch();
  const asked = params.get('ym');
  const ym = asked !== null && YM.test(asked) ? asked : null;
  const oldLeft = params.get('filter') === 'left';
  const left = params.get('left') === '1' || oldLeft;
  const legacy = params.has('by') || params.has('filter');

  useEffect(() => {
    if (legacy) update({ by: null, filter: null, ...(oldLeft ? { left: '1' } : {}) }, true);
  }, [legacy, oldLeft, update]);

  return {
    ym,
    q: params.get('q') ?? '',
    left,
    cancelReason: (left ? 'user_left' : undefined) as CancelReason | undefined,
    setYm: (next: string | null) => update({ ym: next }, true),
    setQ: (next: string) => update({ q: next || null }, true),
    toggleLeft: () => update({ left: left ? null : '1' }, true),
  };
}
