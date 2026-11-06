import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminItems, useAllCategories } from '@/features/catalog/catalog.api';
import { indexCategories, toRows } from '@/features/catalog/catalog-rows';
import { stockListQuery } from './stock.api';
import { toStockRows } from './stock-rows';

export function useStockData() {
  const items = useAdminItems();
  const categories = useAllCategories();
  const stock = useQuery(stockListQuery());
  const index = useMemo(() => indexCategories(categories.data ?? []), [categories.data]);
  const rows = useMemo(
    () => toStockRows(toRows(items.data ?? [], index), new Map((stock.data ?? []).map((f) => [f.item_id, f]))),
    [items.data, index, stock.data],
  );
  const loaded = items.isSuccess && categories.isSuccess && stock.isSuccess;
  const failed = items.isError || categories.isError || stock.isError;
  const retry = () => {
    void items.refetch();
    void categories.refetch();
    void stock.refetch();
  };
  return { index, rows, loaded, failed, retry };
}
