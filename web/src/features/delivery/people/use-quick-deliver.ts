import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import { deliverAll } from '../delivery.api';
import { deliverSelected } from '../use-deliver-selected';
import { useRefreshAfterPeopleDelivery, type DeliveryPerson } from './delivery-people.api';
import { isOpenLine } from './people-filter';

// "Giao đủ" trên thẻ: phiếu kỳ này một lệnh deliver-all, mỗi dòng nợ một lệnh deliver với phần còn lại
export function useQuickDeliver(onIncomplete: (person: DeliveryPerson) => void, onNext: (sub: string) => void) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  const refresh = useRefreshAfterPeopleDelivery();
  const flight = useSingleFlight();

  const send = async (person: DeliveryPerson): Promise<boolean> => {
    let complete = true;
    if (person.request_id && person.lines.some((l) => !l.is_debt && isOpenLine(l))) {
      try {
        complete = (await deliverAll(person.request_id, csrfToken)).failed.length === 0;
      } catch {
        complete = false;
      }
    }
    const debt = person.lines.filter((l) => l.is_debt && isOpenLine(l));
    if (debt.length > 0) {
      const r = await deliverSelected(debt.map((l) => ({ id: l.line_id, qty: l.remaining_qty, expectedDelivered: l.delivered_qty })), csrfToken);
      complete &&= r.failed.length === 0;
    }
    return complete;
  };

  const run = (person: DeliveryPerson, next?: DeliveryPerson) =>
    flight.run(async () => {
      const complete = await send(person);
      await refresh();
      const name = person.full_name ?? person.user_sub;
      if (!complete) {
        toast.show({ text: t('delivery.people.quickFailed', { name }), tone: 'warn' });
        return onIncomplete(person);
      }
      toast.show({
        text: t('delivery.people.panel.delivered', { name }),
        action: next ? { label: t('delivery.people.panel.next'), onClick: () => onNext(next.user_sub) } : undefined,
      });
    });

  return { run, pending: flight.pending };
}
