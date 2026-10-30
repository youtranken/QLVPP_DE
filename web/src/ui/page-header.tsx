import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function PageHeader({ crumbs, title, description, actions }: { crumbs: string[]; title: string; description?: string; actions?: ReactNode }) {
  const { t } = useTranslation();
  return (
    <header className="page-head">
      <div className="page-head__text">
        {crumbs.length > 0 && (
          <nav aria-label={t('common.table.breadcrumb')}>
            <ol className="page-head__crumbs">
              {crumbs.map((c, i) => (
                <li key={`${i}-${c}`} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{c}</li>
              ))}
            </ol>
          </nav>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  );
}
