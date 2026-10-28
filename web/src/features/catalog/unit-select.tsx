import type { SelectHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

const UNITS = ['cai', 'hop', 'cay', 'ram', 'cuon', 'loc', 'bich', 'chai', 'bo'] as const;

export function UnitSelect({
  value,
  onValueChange,
  ...rest
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange'> & {
  value: string;
  onValueChange: (unit: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <select {...rest} value={value} onChange={(e) => onValueChange(e.target.value)}>
      <option value="">{t('catalog.form.unitPlaceholder')}</option>
      {UNITS.map((u) => (
        <option key={u} value={u}>
          {t(`catalog.units.${u}`)}
        </option>
      ))}
    </select>
  );
}
