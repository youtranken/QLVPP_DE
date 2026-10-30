import { Children, type ReactNode } from 'react';

export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="stat-row" data-count={Children.toArray(children).length}>
      {children}
    </div>
  );
}
