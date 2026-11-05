import { useTranslation } from 'react-i18next';
import { apiErrorCode, apiErrorNumber } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import { useRequestFormat } from '@/features/request/request-format';
import { deliverAll } from '../delivery.api';
import { lineErrorText } from '../delivery-errors';
import { deliverSelected, type LineFailureInfo } from '../use-deliver-selected';
import type { DeliveryPerson } from './delivery-people.api';
import { useRefreshAfterFlow } from './use-refresh-after-flow';
import { byPeriod, isOpenLine } from './people-filter';

const NOT_DELIVERABLE = new Set(['LINE_REJECTED', 'LINE_NOT_REVIEWED']);

// "Giao đủ" trên thẻ: nợ giao trước (kỳ cũ nhất trước, mỗi dòng một lệnh deliver với phần còn lại), rồi deliver-all cho phiếu kỳ này
export function useQuickDeliver(onIncomplete: (person: DeliveryPerson) => void, onNext: (sub: string) => void) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const { csrfToken } = useMe();
  const toast = useToast();
  const refresh = useRefreshAfterFlow([['admin-request']]);
  const flight = useSingleFlight();

  const send = async (person: DeliveryPerson): Promise<LineFailureInfo[]> => {
    const failed: LineFailureInfo[] = [];
    const debt = person.lines.filter((l) => l.is_debt && isOpenLine(l)).sort(byPeriod);
    if (debt.length > 0) {
      const r = await deliverSelected(debt.map((l) => ({ id: l.line_id, qty: l.remaining_qty, expectedDelivered: l.delivered_qty })), csrfToken);
      failed.push(...r.failed);
    }
    if (person.request_id && person.lines.some((l) => !l.is_debt && isOpenLine(l))) {
      try {
        const r = await deliverAll(person.request_id, csrfToken);
        // Dòng ngoài DM bị từ chối/chưa duyệt cố ý không giao: không phải thất bại của lần giao này
        failed.push(...r.failed.filter((f) => !NOT_DELIVERABLE.has(f.code)).map((f) => ({ id: f.line_id, code: f.code, available: f.available })));
      } catch (e) {
        failed.push({ id: '', code: apiErrorCode(e) ?? 'UNKNOWN', available: apiErrorNumber(e, 'available') });
      }
    }
    return failed;
  };

  const failureText = (person: DeliveryPerson, name: string, f: LineFailureInfo) => {
    const unit = fmt.unit(person.lines.find((l) => l.line_id === f.id)?.unit ?? null);
    return `${t('delivery.people.quickFailed', { name })} ${lineErrorText(f, unit, t)}`;
  };

  const run = (person: DeliveryPerson, next?: DeliveryPerson) =>
    flight.run(async () => {
      const failed = await send(person);
      await refresh();
      const name = person.full_name ?? person.user_sub;
      if (failed.length > 0) {
        toast.show({ text: failureText(person, name, failed[0]), tone: 'warn' });
        return onIncomplete(person);
      }
      toast.show({
        text: t('delivery.people.panel.delivered', { name }),
        action: next ? { label: t('delivery.people.panel.next'), onClick: () => onNext(next.user_sub) } : undefined,
      });
    });

  return { run, pending: flight.pending };
}
