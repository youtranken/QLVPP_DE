import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api-client';

export interface Unit {
  code: string;
  name: string;
  name_en: string | null;
  sort_order: number;
  active: boolean;
}

// Gồm cả ĐVT đã ngừng (mọi vai) để dòng cũ vẫn hiện đúng tên; trang Đơn vị tính invalidate khóa này sau mỗi lần sửa
export const unitsQuery = queryOptions({
  queryKey: ['units'] as const,
  queryFn: () => apiFetch<Unit[]>('/api/units'),
  staleTime: 5 * 60_000,
});

export const unitLabel = (unit: Pick<Unit, 'name' | 'name_en'>, lang: string) =>
  lang === 'en' && unit.name_en ? unit.name_en : unit.name;

export function useUnitNames(): (code: string | null | undefined) => string {
  const { i18n } = useTranslation();
  const { data } = useQuery(unitsQuery);
  const lang = i18n.language;
  const byCode = useMemo(() => new Map((data ?? []).map((u) => [u.code, u])), [data]);
  return useCallback(
    (code: string | null | undefined) => {
      if (!code) return '';
      const unit = byCode.get(code);
      return unit ? unitLabel(unit, lang) : code;
    },
    [byCode, lang],
  );
}

export function useUnitName(code: string | null | undefined): string {
  return useUnitNames()(code);
}

export interface AdminUnit extends Unit {
  in_use: boolean;
  item_count: number;
}

export type UnitPayload = Partial<Pick<Unit, 'name' | 'name_en' | 'sort_order' | 'active'>>;

// Khóa con của ['units']: một lần invalidate ['units'] làm mới cả ô chọn lẫn trang quản lý
export function useAdminUnits() {
  return useQuery({
    queryKey: [...unitsQuery.queryKey, 'all'] as const,
    queryFn: () => apiFetch<AdminUnit[]>('/api/units?all=1'),
  });
}

export function useRefreshUnits() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: unitsQuery.queryKey }), [qc]);
}

export const createUnit = (body: UnitPayload, csrfToken: string | null) =>
  apiFetch<Unit>('/api/admin/units', { method: 'POST', body: JSON.stringify(body), csrfToken });

export const patchUnit = (code: string, body: UnitPayload, csrfToken: string | null) =>
  apiFetch<Unit>(`/api/admin/units/${code}`, { method: 'PATCH', body: JSON.stringify(body), csrfToken });

export const deleteUnit = (code: string, csrfToken: string | null) =>
  apiFetch<void>(`/api/admin/units/${code}`, { method: 'DELETE', csrfToken });
