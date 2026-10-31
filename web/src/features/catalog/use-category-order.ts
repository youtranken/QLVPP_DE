import { useTranslation } from 'react-i18next';
import { compareCategories } from '@/lib/group-tone';
import { useLocalOrder } from '@/lib/use-local-order';
import { useMe } from '@/lib/me';
import { useToast } from '@/ui/toast-context';
import { patchCategory, useRefreshCatalog, type Category } from './catalog.api';

const keyOf = (c: Category) => c.id;

export function useCategoryOrder(server: Category[]) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  return useLocalOrder({
    server,
    keyOf,
    sort: compareCategories,
    patchOrder: (id, sort_order) => patchCategory(id, { sort_order }, csrfToken),
    refresh: useRefreshCatalog(),
    onSaved: (n) => toast.show({ text: t('catalog.categories.orderSaved', { n }), tone: 'ok' }),
    onPartial: (a, n) => toast.show({ text: t('catalog.categories.orderPartial', { a, n }), tone: 'warn' }),
  });
}
