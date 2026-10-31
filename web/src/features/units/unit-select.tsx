import type { SelectHTMLAttributes } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { unitsQuery, useUnitNames } from './units.api';

export function UnitSelect({
  value,
  onValueChange,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (unit: string) => void;
}) {
  const { t } = useTranslation();
  const { data = [] } = useQuery(unitsQuery);
  const unitName = useUnitNames();
  const active = data.filter((u) => u.active);
  // Món/dòng cũ giữ ĐVT đã ngừng: vẫn hiện lựa chọn đang có, server cho lưu lại khi không đổi
  const kept = value && !active.some((u) => u.code === value) ? value : null;
  return (
    <select {...rest} value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">{t('catalog.form.unitPlaceholder')}</option>
      {active.map((u) => (
        <option key={u.code} value={u.code}>
          {unitName(u.code)}
        </option>
      ))}
      {kept && <option value={kept}>{unitName(kept)}</option>}
    </select>
  );
}
