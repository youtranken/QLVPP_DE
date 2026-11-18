import { Children, type ReactNode } from 'react';
import { StatFilterContext } from '@/ui/stat-filter-context';

// onSelect: hàng thẻ là bộ lọc — tablist, mỗi thẻ có filterKey là một tab; label: tên nhóm cho trình đọc màn hình
export function StatRow({ children, label, selected, onSelect }: { children: ReactNode; label?: string; selected?: string; onSelect?: (key: string) => void }) {
  const filter = onSelect ? { selected: selected ?? '', onSelect } : null;
  const role = filter ? 'tablist' : label ? 'group' : undefined;
  return (
    <StatFilterContext.Provider value={filter}>
      <div className="stat-row" data-count={Children.toArray(children).length} role={role} aria-label={label}>
        {children}
      </div>
    </StatFilterContext.Provider>
  );
}
