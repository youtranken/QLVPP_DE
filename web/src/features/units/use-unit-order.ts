import { useTranslation } from 'react-i18next';
import { useLocalOrder } from '@/lib/use-local-order';
import { useMe } from '@/lib/me';
import { useToast } from '@/ui/toast-context';
import { compareUnits } from './unit-order';
import { patchUnit, useRefreshUnits, type AdminUnit } from './units.api';

const keyOf = (u: AdminUnit) => u.code;

export function useUnitOrder(server: AdminUnit[]) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  return useLocalOrder({
    server,
    keyOf,
    sort: compareUnits,
    patchOrder: (code, sort_order) => patchUnit(code, { sort_order }, csrfToken),
    refresh: useRefreshUnits(),
    onSaved: (n) => toast.show({ text: t('units.page.orderSaved', { n }), tone: 'ok' }),
    onPartial: (a, n) => toast.show({ text: t('units.page.orderPartial', { a, n }), tone: 'warn' }),
  });
}
