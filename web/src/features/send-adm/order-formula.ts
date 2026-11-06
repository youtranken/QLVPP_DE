import { useTranslation } from 'react-i18next';
import { diffOf } from '@/lib/report-qty';
import type { OrderRow } from './send-adm-rows';

const monthNo = (ym: string) => String(Number(ym.slice(5)));

export function useFormulaText() {
  const { t } = useTranslation();
  return (row: OrderRow) => {
    const parts = [t(row.delivered > 0 ? 'sendAdm.order.formulaUndelivered' : 'sendAdm.order.formula', { a: row.requested, b: row.backlog })];
    if (row.admOwed > 0) {
      const m = row.admMonths.map(monthNo).join(', ');
      parts.push(m ? t('sendAdm.order.owed', { c: row.admOwed, m }) : t('sendAdm.order.owedNoMonth', { c: row.admOwed }));
    }
    if (row.left > 0) parts.push(t('sendAdm.order.left', { e: row.left }));
    return parts.join(' ');
  };
}

export const orderDiff = (row: OrderRow, order: number) => diffOf({ stock: row.stock ?? 0, order, adm_owed: row.admOwed, need: row.need });
