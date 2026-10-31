import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import type { Selection } from '@/ui/data-table-row';
import { useToast } from '@/ui/toast-context';
import { patchItem, type ItemPayload } from './catalog.api';
import { rowErrorText } from './catalog-errors';

export interface BulkResult {
  done: string[];
  failed: { id: string; error: unknown }[];
}

// D12: mỗi món một PATCH (một audit), lần lượt; lỗi một món không dừng các món sau
export async function patchEach(ids: string[], body: ItemPayload, csrfToken: string | null): Promise<BulkResult> {
  const result: BulkResult = { done: [], failed: [] };
  for (const id of ids) {
    try {
      await patchItem(id, body, csrfToken);
      result.done.push(id);
    } catch (error) {
      result.failed.push({ id, error });
    }
  }
  return result;
}

export function useBulkItems(refresh: () => Promise<unknown>) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  const flight = useSingleFlight();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const selection: Selection = {
    selected,
    onToggle: (id) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    onToggleAll: (ids, checked) =>
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) {
          if (checked) next.add(id);
          else next.delete(id);
        }
        return next;
      }),
  };

  const setRowError = useCallback((id: string, text: string | null) => {
    setRowErrors((prev) => {
      const next = { ...prev };
      if (text) next[id] = text;
      else delete next[id];
      return next;
    });
  }, []);

  // orderedIds: thứ tự hàng trên bảng, để PATCH đi đúng thứ tự người dùng thấy
  const run = (orderedIds: string[], body: ItemPayload, doneText: (n: number) => string) =>
    flight.run(async () => {
      const ids = orderedIds.filter((id) => selected.has(id));
      const { done, failed } = await patchEach(ids, body, csrfToken);
      setSelected(new Set(failed.map((f) => f.id)));
      setRowErrors(Object.fromEntries(failed.map((f) => [f.id, rowErrorText(f.error, t)])));
      if (failed.length === 0) toast.show({ text: doneText(done.length), tone: 'ok' });
      else toast.show({ text: t('catalog.bulk.partial', { a: done.length, n: ids.length }), tone: 'warn' });
      await refresh();
    });

  return {
    selection,
    count: selected.size,
    rowErrors,
    pending: flight.pending,
    setRowError,
    run,
    clear: () => {
      setSelected(new Set());
      setRowErrors({});
    },
  };
}
