import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@/ui/icon';

export type StatTone = 'neutral' | 'warn' | 'danger' | 'dark';

interface Props {
  label: string;
  icon?: IconName;
  value: ReactNode;
  unit?: string;
  sub?: string;
  tone?: StatTone;
  pressed?: boolean;
  meter?: number;
  onClick?: () => void;
}

// Màu cảnh báo chỉ khi chính con số hiển thị > 0 — ô không được đỏ vì một số khác
function shownTone(tone: StatTone, value: ReactNode): StatTone {
  if (tone !== 'warn' && tone !== 'danger') return tone;
  return typeof value === 'number' && value > 0 ? tone : 'neutral';
}

export function StatCard({ label, icon, value, unit, sub, tone = 'neutral', pressed, meter, onClick }: Props) {
  const { t } = useTranslation();
  const fill = meter === undefined ? undefined : Math.min(Math.max(meter, 0), 1) * 100;
  const body = (
    <>
      <span className="stat-card__k">
        {icon && <Icon name={icon} size={16} />}
        {label}
      </span>
      <span className="stat-card__v num">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {sub && (
        <span className="stat-card__sub" title={sub}>
          {sub}
        </span>
      )}
      {fill !== undefined && (
        <span className="stat-card__meter" data-meter aria-hidden="true">
          <span style={{ width: `${fill}%` }} />
        </span>
      )}
      {onClick && <span className="stat-card__hint" aria-hidden="true">{t('common.filter.hint')}</span>}
    </>
  );
  const common = { className: 'stat-card', 'data-tone': shownTone(tone, value) };
  if (!onClick) return <div {...common}>{body}</div>;
  return (
    <button type="button" {...common} aria-pressed={pressed ?? false} onClick={onClick}>
      {body}
    </button>
  );
}
