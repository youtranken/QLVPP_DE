import { useTranslation } from 'react-i18next';
import { previewMonth } from './config-calendar';
import { isWhole, wholeIn } from './config-form';

const LEGEND = ['open', 'reminder', 'deadline', 'locked'] as const;

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${Number(m)}/${y}`;
};

export function PeriodPreview({ ym, lastDay, reminder }: { ym: string; lastDay: string; reminder: string }) {
  const { t } = useTranslation();
  if (!wholeIn(lastDay, 3, 28)) return <p className="cf-preview cf-preview--empty">{t('config.preview.invalid')}</p>;
  const { leadingBlanks, days } = previewMonth(ym, Number(lastDay), isWhole(reminder) ? Number(reminder) : null);
  const weekdays = t('config.preview.weekdays').split(',');
  return (
    <div className="cf-preview">
      <h3 className="cf-preview__title">{t('config.preview.heading', { month: monthLabel(ym) })}</h3>
      <div className="cf-cal__head" aria-hidden="true">
        {weekdays.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <ol className="cf-cal" aria-label={t('config.preview.title', { month: monthLabel(ym) })}>
        {days.map((d) => (
          <li
            key={d.day}
            className="cf-day"
            data-kind={d.kind}
            data-reminder={d.reminder || undefined}
            style={d.day === 1 && leadingBlanks > 0 ? { gridColumnStart: leadingBlanks + 1 } : undefined}
          >
            <span className="cf-day__n num">{d.day}</span>
            <span className="cf-day__k">
              {d.day === 1 && t('config.preview.open')}
              {d.kind === 'deadline' && t('config.preview.deadline')}
              {d.day === Number(lastDay) + 1 && t('config.preview.locked')}
              {d.reminder && <span className="cf-day__remind">{t('config.preview.reminder')}</span>}
            </span>
          </li>
        ))}
      </ol>
      <ul className="cf-legend">
        {LEGEND.map((k) => (
          <li key={k} data-kind={k}>
            {t(`config.preview.${k}`)}
          </li>
        ))}
      </ul>
      <p className="cf-preview__hint">{t('config.preview.hint')}</p>
    </div>
  );
}
