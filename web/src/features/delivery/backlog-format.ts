import { useTranslation } from 'react-i18next';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import type { BacklogLine } from './backlog.api';

export function useBacklogFormat() {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  return {
    name: (l: Pick<BacklogLine, 'name' | 'name_en'>) => fmt.name(l),
    unit: fmt.unit,
    person: (l: Pick<BacklogLine, 'full_name' | 'user_sub'>) => l.full_name ?? l.user_sub,
    month: (ym: string) => t('delivery.month', { month: monthOf(ym), year: ym.slice(0, 4) }),
  };
}
