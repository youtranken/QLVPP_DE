import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api-client';
import { formatVnStamp } from '@/lib/format-time';
import { useUnitNames } from '@/features/units/units.api';

type PendingArrival = { remaining: number; unit?: string; snapshot_at?: string };

const fetchPending = (id: string) =>
  apiFetch<PendingArrival>(`/api/admin/items/${id}/pending-arrival`).catch(() => null);

// Khối cam "đang chờ ADM giao" cho hộp ngừng món/nhóm; lỗi tải thì bỏ khối, không chặn việc ngừng
export function usePendingArrivalNote() {
  const { t } = useTranslation();
  const unitName = useUnitNames();
  return useCallback(
    async (items: { id: string; name: string }[], withNames: boolean): Promise<ReactNode | undefined> => {
      const found = await Promise.all(items.map(async (item) => ({ item, p: await fetchPending(item.id) })));
      const lines = found.flatMap(({ item, p }) =>
        p && p.remaining > 0 && p.unit && p.snapshot_at
          ? [{ id: item.id, name: item.name, text: t('warn.W24', { n: p.remaining, unit: unitName(p.unit), time: formatVnStamp(p.snapshot_at) }) }]
          : [],
      );
      if (lines.length === 0) return undefined;
      return (
        <ul className="w24-list">
          {lines.map((l) => (
            <li key={l.id}>
              {withNames && <strong>{l.name}: </strong>}
              {l.text}
            </li>
          ))}
        </ul>
      );
    },
    [t, unitName],
  );
}
