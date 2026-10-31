import { queryOptions, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
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
  return useCallback(
    (code: string | null | undefined) => {
      if (!code) return '';
      const unit = data?.find((u) => u.code === code);
      return unit ? unitLabel(unit, lang) : code;
    },
    [data, lang],
  );
}

export function useUnitName(code: string | null | undefined): string {
  return useUnitNames()(code);
}
