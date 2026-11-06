import { useTranslation } from 'react-i18next';
import { langOf, lockPhrase } from '@/lib/period-text';
import { monthOf } from '@/features/request/request-format';

// Câu "chưa khóa sổ — xem được từ …" cho 409 PERIOD_NOT_LOCKED và kỳ chưa tới hạn
export function useUnlockedSentence(ym: string) {
  const { t, i18n } = useTranslation();
  const lang = langOf(i18n.language);
  return (deadline: string | undefined) =>
    deadline ? t('summary.gate.unlocked', { month: monthOf(ym), lockPhrase: lockPhrase(deadline, lang) }) : t('summary.gate.unlockedNoDate', { month: monthOf(ym) });
}
