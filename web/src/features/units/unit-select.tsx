import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { FieldControlProps } from '@/ui/form-field';
import { Listbox } from '@/ui/listbox';
import { unitsQuery, useUnitNames } from './units.api';

export function UnitSelect({
  value,
  onValueChange,
  className,
  ...field
}: Partial<FieldControlProps> & {
  value: string;
  className?: string;
  onValueChange: (unit: string) => void;
}) {
  const { t } = useTranslation();
  const { data = [] } = useQuery(unitsQuery);
  const unitName = useUnitNames();
  const active = data.filter((u) => u.active);
  // Món/dòng cũ giữ ĐVT đã ngừng: vẫn hiện lựa chọn đang có, server cho lưu lại khi không đổi
  const kept = value && !active.some((u) => u.code === value) ? value : null;
  const options = [...active.map((u) => ({ value: u.code, label: unitName(u.code) })), ...(kept ? [{ value: kept, label: unitName(kept) }] : [])];
  return <Listbox {...field} className={className} value={value} options={options} placeholder={t('catalog.form.unitPlaceholder')} onChange={onValueChange} />;
}
