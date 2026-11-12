import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { monthOf } from '@/features/request/request-format';
import type { DeliveryPerson } from './delivery-people.api';
import { dialogRows, isNotReceived, limitsOf, priorityFor, stockShortages, totalsOf } from './deliver-plan';
import { DeliverDialog } from './deliver-dialog';
import { waitingIndex } from './people-filter';
import { PersonLineRow } from './person-line-row';

export interface PersonPanelProps {
  ym: string;
  person: DeliveryPerson;
  people: DeliveryPerson[];
  next?: DeliveryPerson;
  onNext?: (sub: string) => void;
  // Giao hết thành công từ panel: đóng cả hộp lẫn panel
  onDelivered?: () => void;
  focusAfter?: () => boolean;
  // Khung chứa (OverlayPanel của trang): dòng tổng + nút Giao… đặt vào khe footer để dính đáy panel
  frame?: (body: ReactNode, footer: ReactNode) => ReactNode;
}

const inline = (body: ReactNode, footer: ReactNode) => (
  <>
    {body}
    {footer}
  </>
);

const NO_WAIT = { people: 0, qty: 0 };

export function PersonPanel({ ym, person, people, next, onNext, onDelivered, focusAfter, frame = inline }: PersonPanelProps) {
  const { t } = useTranslation();
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState(false);
  const plan = useMemo(
    () => ({ rows: dialogRows(person, priorityFor(person, people)), waitingOn: waitingIndex(people), shortages: stockShortages(people) }),
    [person, people],
  );
  const limits = limitsOf(plan.rows, qtys);
  const totals = totalsOf(plan.rows, limits);
  const values = Object.fromEntries(Object.entries(limits).map(([id, l]) => [id, l.value]));

  const groups = [
    { key: 'debt', title: t('delivery.people.panel.debtGroup'), rows: plan.rows.filter((r) => r.line.is_debt) },
    { key: 'month', title: t('delivery.people.panel.monthGroup', { month: monthOf(ym) }), rows: plan.rows.filter((r) => !r.line.is_debt) },
  ].filter((g) => g.rows.length > 0);

  if (person.status === 'done') return frame(<p className="pp-done">{t('delivery.people.panel.done')}</p>, null);

  const name = person.full_name ?? person.user_sub;
  const footer = (
    <>
      <p className="pp-sum">
        {totals.left > 0 ? t('delivery.people.panel.sumOwe', { give: totals.give, left: totals.left }) : t('delivery.people.panel.sum', { give: totals.give })}
        {totals.debt > 0 && t('delivery.people.panel.sumDebt', { debt: totals.debt })}
      </p>
      <button type="button" className="btn btn--primary pp-deliver" disabled={totals.give === 0 && totals.cancel === 0} onClick={() => setConfirming(true)}>
        {t('delivery.people.panel.deliver')}
      </button>
    </>
  );
  const body = (
    <section className="pp-panel" aria-label={t('delivery.people.panel.label', { name })}>
      {groups.map((g) => (
        <section key={g.key} className={`pp-group pp-group--${g.key}`}>
          <h3>{g.title}</h3>
          <ul>
            {g.rows.map((row) => (
              <PersonLineRow
                key={row.line.line_id}
                line={row.line}
                notReceived={isNotReceived(row)}
                value={limits[row.line.line_id]?.value ?? 0}
                max={limits[row.line.line_id]?.cap ?? 0}
                taken={limits[row.line.line_id]?.taken ?? false}
                waiting={row.line.item_id ? plan.waitingOn(row.line.item_id, person.user_sub) : NO_WAIT}
                shortage={row.line.item_id ? plan.shortages.get(row.line.item_id) : undefined}
                disabled={confirming}
                onChange={(n) => setQtys((q) => ({ ...q, [row.line.line_id]: n }))}
              />
            ))}
          </ul>
        </section>
      ))}
      {confirming && (
        <DeliverDialog
          person={person}
          people={people}
          initial={values}
          next={next}
          onNext={onNext}
          onClose={() => setConfirming(false)}
          onOpenPerson={() => setConfirming(false)}
          onDone={() => {
            setConfirming(false);
            setQtys({});
            onDelivered?.();
          }}
          focusAfter={focusAfter}
        />
      )}
    </section>
  );
  return frame(body, footer);
}
