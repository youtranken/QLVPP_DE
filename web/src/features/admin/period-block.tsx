import { useTranslation } from 'react-i18next';
import { langOf } from '@/lib/period-text';
import { shiftYm } from '@/lib/ym';
import { FormField } from '@/ui/form-field';
import { useCurrentPeriod } from '@/features/request/request.api';
import { periodClears, type PeriodDraft } from './config-form';
import { ConfigSection } from './config-section';
import { DayInput } from './day-input';
import { effectiveSentence } from './effective-period';
import { PeriodPreview } from './period-preview';
import type { ConfigBlockState } from './use-config-block';

export function PeriodBlock({ state }: { state: ConfigBlockState<PeriodDraft> }) {
  const { t, i18n } = useTranslation();
  const period = useCurrentPeriod().data;
  const { draft, errors, update } = state;
  const err = (k: keyof PeriodDraft) => (errors[k] ? t(errors[k]) : undefined);
  const set = (k: keyof PeriodDraft) => (v: string) => update((d) => ({ ...d, [k]: v }), periodClears(k));
  const note = period ? effectiveSentence(t, langOf(i18n.language), period, draft.registration_last_day) : t('config.period.note');

  return (
    <ConfigSection title={t('config.period.title')} saveLabel={t('config.period.save')} state={state}>
      <div className="cf-fields">
        <DayInput
          label={t('config.period.lastDay')}
          hint={t('config.period.lastDayHint')}
          unit={t('config.period.lastDayUnit')}
          error={err('registration_last_day')}
          value={draft.registration_last_day}
          min={3}
          max={28}
          downLabel={t('config.period.lastDayDown')}
          upLabel={t('config.period.lastDayUp')}
          onChange={set('registration_last_day')}
        />
        <DayInput
          label={t('config.period.reminder')}
          hint={t('config.period.reminderHint')}
          unit={t('config.period.reminderUnit')}
          error={err('reminder_days_left')}
          value={draft.reminder_days_left}
          min={1}
          max={7}
          downLabel={t('config.period.reminderDown')}
          upLabel={t('config.period.reminderUp')}
          onChange={set('reminder_days_left')}
        />
        <FormField label={t('config.period.defaultMax')} hint={t('config.period.defaultMaxHint')} error={err('default_max_qty')}>
          {(p) => (
            <div className="cf-day-input">
              <input
                {...p}
                type="number"
                inputMode="numeric"
                step={1}
                min={1}
                max={999}
                className="num cf-qty"
                value={draft.default_max_qty}
                onChange={(e) => set('default_max_qty')(e.target.value)}
              />
              <span className="cf-unit">{t('config.period.defaultMaxUnit')}</span>
            </div>
          )}
        </FormField>
      </div>
      <p className="alert" aria-live="polite">{note}</p>
      {period && <PeriodPreview ym={shiftYm(period.ym, 1)} lastDay={draft.registration_last_day} reminder={draft.reminder_days_left} />}
    </ConfigSection>
  );
}
