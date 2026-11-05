import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { lineErrorText } from '../delivery-errors';
import { deliverSelected } from '../use-deliver-selected';
import type { DeliveryPerson } from './delivery-people.api';
import { useRefreshAfterFlow } from './use-refresh-after-flow';
import { allocateLines, byPeriod, waitingIndex } from './people-filter';
import { PersonLineRow } from './person-line-row';

export interface PersonPanelProps {
  ym: string;
  person: DeliveryPerson;
  people: DeliveryPerson[];
  next?: DeliveryPerson;
  onNext?: (sub: string) => void;
}

const NO_WAIT = { people: 0, qty: 0 };

export function PersonPanel({ ym, person, people, next, onNext }: PersonPanelProps) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const { csrfToken } = useMe();
  const toast = useToast();
  const refresh = useRefreshAfterFlow([['admin-request']]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [caps, setCaps] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const flight = useSingleFlight();
  const waitingOn = useMemo(() => waitingIndex(people), [people]);
  const busy = flight.pending;

  const name = person.full_name ?? person.user_sub;
  const shown = person.lines.filter((l) => l.remaining_qty > 0 || l.review_status === 'pending').sort(byPeriod);
  const alloc = allocateLines(shown, qtys, caps);
  const maxOf = (id: string) => alloc[id]?.max ?? 0;
  const valueOf = (id: string) => alloc[id]?.value ?? 0;
  const toDeliver = shown.filter((l) => valueOf(l.line_id) > 0);
  const give = toDeliver.reduce((s, l) => s + valueOf(l.line_id), 0);
  const owe = shown.filter((l) => l.review_status !== 'pending').reduce((s, l) => s + l.remaining_qty, 0) - give;

  const deliver = () =>
    flight.run(async () => {
      const result = await deliverSelected(
        toDeliver.map((l) => ({ id: l.line_id, qty: valueOf(l.line_id), expectedDelivered: l.delivered_qty })),
        csrfToken,
      );
      await refresh();
      const nextCaps: Record<string, number> = {};
      const nextErrors: Record<string, string> = {};
      for (const f of result.failed) {
        const l = person.lines.find((x) => x.line_id === f.id)!;
        nextErrors[f.id] = lineErrorText(f, fmt.unit(l.unit), t);
        if (f.code === 'STOCK_INSUFFICIENT') nextCaps[f.id] = f.available ?? 0;
      }
      setCaps(nextCaps);
      setErrors(nextErrors);
      setQtys({});
      if (result.failed.length === 0) {
        toast.show({
          text: t('delivery.people.panel.delivered', { name }),
          action: next && onNext ? { label: t('delivery.people.panel.next'), onClick: () => onNext(next.user_sub) } : undefined,
        });
      } else if (result.delivered.length > 0) {
        toast.show({ text: t('delivery.people.panel.partial', { name }), tone: 'warn' });
      }
    });

  const groups = [
    { key: 'debt', title: t('delivery.people.panel.debtGroup'), lines: shown.filter((l) => l.is_debt) },
    { key: 'month', title: t('delivery.people.panel.monthGroup', { month: monthOf(ym) }), lines: shown.filter((l) => !l.is_debt) },
  ].filter((g) => g.lines.length > 0);

  if (person.status === 'done') return <p className="pp-done">{t('delivery.people.panel.done')}</p>;

  return (
    <section className="pp-panel" aria-label={t('delivery.people.panel.label', { name })}>
      {groups.map((g) => (
        <section key={g.key} className={`pp-group pp-group--${g.key}`}>
          <h3>{g.title}</h3>
          <ul>
            {g.lines.map((l) => (
              <PersonLineRow
                key={l.line_id}
                line={l}
                value={valueOf(l.line_id)}
                max={maxOf(l.line_id)}
                taken={alloc[l.line_id]?.taken ?? false}
                error={errors[l.line_id]}
                waiting={l.item_id ? waitingOn(l.item_id, person.user_sub) : NO_WAIT}
                disabled={busy}
                onChange={(n) => setQtys((q) => ({ ...q, [l.line_id]: n }))}
              />
            ))}
          </ul>
        </section>
      ))}
      <footer className="pp-foot">
        <p className="pp-sum">{owe > 0 ? t('delivery.people.panel.sumOwe', { give, owe }) : t('delivery.people.panel.sum', { give })}</p>
        <button type="button" className="btn btn--primary" disabled={busy || toDeliver.length === 0} onClick={() => void deliver()}>
          {busy ? t('delivery.people.panel.sending') : t('delivery.people.panel.deliver')}
        </button>
      </footer>
    </section>
  );
}
