import { useTranslation } from 'react-i18next';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import type { DeliveryPerson } from './delivery-people.api';
import { PEOPLE_TABS, type PeopleTab } from './people-tabs';

export function PeopleStats({ tabs, value, onSelect }: { tabs: Record<PeopleTab, DeliveryPerson[]>; value: PeopleTab; onSelect: (tab: PeopleTab) => void }) {
  const { t } = useTranslation();
  return (
    <StatRow label={t('delivery.people.filter')} selected={value} onSelect={(k) => onSelect(k as PeopleTab)}>
      {PEOPLE_TABS.map((tab) => (
        <StatCard
          key={tab}
          filterKey={tab}
          label={t(`delivery.people.tabs.${tab}`)}
          value={tabs[tab].length}
          sub={t(`delivery.people.tabSub.${tab}`, { n: tabs.ready.length })}
          tone={tab === 'left' ? 'danger' : 'neutral'}
        />
      ))}
    </StatRow>
  );
}
