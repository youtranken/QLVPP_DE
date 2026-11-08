import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import type { StepState } from './month-steps';

interface Props {
  steps: StepState[];
  // Kỳ đang đăng ký (hoặc kỳ cũ): chỉ bước Đăng ký có số, các bước sau mờ đi
  onlyFirst?: boolean;
}

export function MonthStrip({ steps, onlyFirst = false }: Props) {
  const { t } = useTranslation();
  return (
    <ol className="mk-strip" aria-label={t('month.steps.label')}>
      {steps.map((s, i) => {
        const muted = onlyFirst && i > 0;
        const current = s.current && !muted;
        const body = (
          <>
            <span className="mk-step__name">
              {s.done && !muted && <Icon name="check" size={16} />}
              {t(`month.steps.${s.key}`)}
            </span>
            <span className="mk-step__value num">{muted ? t('month.value.none') : s.value}</span>
          </>
        );
        return (
          <li key={s.key} className="mk-step" data-state={muted ? 'muted' : s.done ? 'done' : current ? 'current' : 'todo'} aria-current={current ? 'step' : undefined}>
            {muted ? (
              <span className="mk-step__link">{body}</span>
            ) : (
              <Link className="mk-step__link" to={s.to}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}
