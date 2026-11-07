import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import type { StepState } from './month-steps';

function useStepText() {
  const { t } = useTranslation();
  return (s: StepState, muted: boolean): { value: string; note: string } => {
    if (muted) return { value: t('home.value.none'), note: t('home.step.later') };
    const state = s.done ? 'Done' : 'Todo';
    switch (s.key) {
      case 'register':
        return { value: s.value, note: t(s.done ? 'home.note.registerDone' : 'home.note.registerOpen') };
      case 'send':
      case 'arrive':
        return { value: s.value, note: s.note ?? '' };
      case 'deliver':
        return { value: s.done ? t('home.value.deliverDone') : s.value, note: t(`home.note.deliver${state}`) };
    }
  };
}

interface Props {
  steps: StepState[];
  // Kỳ đang đăng ký: chỉ bước 1 hoạt động, các bước sau mờ đi
  onlyFirst?: boolean;
}

export function MonthSteps({ steps, onlyFirst = false }: Props) {
  const { t } = useTranslation();
  const text = useStepText();
  return (
    <ol className="hm-steps" aria-label={t('home.stepsLabel')}>
      {steps.map((s, i) => {
        const muted = onlyFirst && i > 0;
        const { value, note } = text(s, muted);
        const current = s.current && !muted;
        return (
          <li key={s.key} className="hm-step" data-state={muted ? 'muted' : s.done ? 'done' : current ? 'current' : 'todo'} aria-current={current ? 'step' : undefined}>
            <div className="hm-step__head">
              <span className="hm-step__dot" aria-hidden="true">
                {s.done && !muted ? <Icon name="check" size={15} /> : i + 1}
              </span>
              <span className="hm-step__name">{t(`home.step.${s.key}`)}</span>
            </div>
            <div className="hm-step__value">{value}</div>
            {note && <div className="hm-step__note">{note}</div>}
            {s.link && !muted && (
              <Link className="hm-step__link" to={s.link.to}>
                {s.link.label}
              </Link>
            )}
            {current && (
              <div className="hm-step__go">
                {s.progress !== undefined && (
                  <div className="hm-bar" role="progressbar" aria-label={t('home.progress', { value: s.progress })} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.progress}>
                    <span style={{ width: `${s.progress}%` }} />
                  </div>
                )}
                {s.waitLabel ? (
                  <span className="btn hm-cta" aria-disabled="true">
                    {s.waitLabel}
                  </span>
                ) : (
                  <Link className="btn hm-cta" to={s.to}>
                    {t(`home.cta.${s.key}`)}
                  </Link>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
