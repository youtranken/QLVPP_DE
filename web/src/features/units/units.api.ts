import { queryOptions, useQuery } from '@tanstack/react-query';
import { useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '@/lib/api-client';
import { MeContext, isAdminRole } from '@/lib/me';

export interface Unit {
  code: string;
  name: string;
  name_en: string | null;
  sort_order: number;
  active: boolean;
  in_use?: boolean;
}

export const UNITS_KEY = ['units'] as const;
// ĐVT ít khi đổi; trang Đơn vị tính invalidate khóa ['units'] sau mỗi lần sửa
const STALE_MS = 5 * 60_000;

const unitsQueryOf = (all: boolean) =>
  queryOptions<Unit[], Error, Unit[], readonly string[]>({
    queryKey: all ? [...UNITS_KEY, 'all'] : UNITS_KEY,
    queryFn: () => apiFetch<Unit[]>(all ? '/api/units?all=1' : '/api/units'),
    staleTime: STALE_MS,
  });

export const unitsQuery = unitsQueryOf(false);
export const allUnitsQuery = unitsQueryOf(true);

// Hành chính đọc cả ĐVT đã ngừng để món/dòng cũ vẫn hiện đúng tên; member chỉ được đọc ĐVT đang dùng
export function useUnitNames(): (code: string | null | undefined) => string {
  const { i18n } = useTranslation();
  const role = useContext(MeContext)?.role;
  const { data } = useQuery(role && isAdminRole(role) ? allUnitsQuery : unitsQuery);
  const en = i18n.language === 'en';
  return useCallback(
    (code: string | null | undefined) => {
      if (!code) return '';
      const unit = data?.find((u) => u.code === code);
      if (!unit) return code;
      return en && unit.name_en ? unit.name_en : unit.name;
    },
    [data, en],
  );
}

export function useUnitName(code: string | null | undefined): string {
  return useUnitNames()(code);
}
