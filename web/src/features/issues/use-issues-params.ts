import { useUrlPatch } from '@/lib/use-url-patch';
import { YM, vnYmNow } from '@/lib/ym';

// Không có ym → tháng lịch hiện tại (giờ VN): xuất lẻ tính theo tháng lịch, không theo kỳ đăng ký
export function useIssuesParams() {
  const [params, update] = useUrlPatch();
  const rawYm = params.get('ym') ?? '';
  return {
    ym: YM.test(rawYm) ? rawYm : vnYmNow(),
    q: params.get('q') ?? '',
    setYm: (next: string) => update({ ym: next }),
    setQ: (next: string) => update({ q: next || null }, true),
  };
}
