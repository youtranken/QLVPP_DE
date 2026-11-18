import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import type { StepState } from './month-steps';

interface Props {
  steps: StepState[];
  // Kỳ đang đăng ký: chỉ bước Đăng ký có số, các bước sau mờ đi
  onlyFirst?: boolean;
}

// Tiến trình, không phải điều hướng: bước không bấm được để khỏi giống thẻ "đang chọn"
export function MonthStrip({ steps, onlyFirst = false }: Props) {
  const { t } = useTranslation();
  return (
    <ol className="mk-strip" aria-label={t('month.steps.label')}>
      {steps.map((s, i) => {
        const muted = onlyFirst && i > 0;
        const current = s.current && !muted;
        const state = muted ? 'muted' : s.done ? 'done' : current ? 'current' : 'todo';
        return (
          <li key={s.key} className="mk-step" data-state={state} aria-current={current ? 'step' : undefined}>
            <span className="mk-step__dot" aria-hidden="true">
              {state === 'done' && <Icon name="check" size={14} />}
            </span>
            <span className="mk-step__text">
              <span className="mk-step__name">{t(`month.steps.${s.key}`)}</span>
              <span className="mk-step__value num">{muted ? t('month.value.none') : s.value}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
