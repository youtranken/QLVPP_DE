import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  crumbs: string[];
  title: string;
  description?: string;
  // Dòng phụ có liên kết (nguồn dữ liệu…), nằm ngay dưới tiêu đề
  sub?: ReactNode;
  primary?: ReactNode;
  secondary?: ReactNode;
  note?: ReactNode;
}

export function PageHeader({ crumbs, title, description, sub, primary, secondary, note }: Props) {
  const { t } = useTranslation();
  const actions = (primary || secondary) && (
    <div className="page-head__actions" role="group" aria-label={t('common.pageActions')}>
      {secondary}
      {primary}
    </div>
  );
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
        {description && <p className="page-head__desc">{description}</p>}
        {sub && <p className="page-head__sub">{sub}</p>}
      </div>
      {note ? (
        <div className="page-head__side">
          {note}
          {actions}
        </div>
      ) : (
        actions
      )}
    </header>
  );
}
