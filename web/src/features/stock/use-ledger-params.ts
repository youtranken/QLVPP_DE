import { useUrlPatch } from '@/lib/use-url-patch';
import { YM, vnYmNow } from '@/lib/ym';
import { LEDGER_KINDS, type LedgerKind } from './stock-ledger.api';

// Không có ym → tháng lịch hiện tại (giờ VN), như trang Xuất lẻ
export function useLedgerParams() {
  const [params, update] = useUrlPatch();
  const rawYm = params.get('ym') ?? '';
  const rawKind = params.get('kind');
  return {
    ym: YM.test(rawYm) ? rawYm : vnYmNow(),
    kind: LEDGER_KINDS.includes(rawKind as LedgerKind) ? (rawKind as LedgerKind) : null,
    setYm: (next: string) => update({ ym: next }),
    setKind: (next: LedgerKind | null) => update({ kind: next }),
  };
}
