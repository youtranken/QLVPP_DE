import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { useMyIssues } from './history.api';
import { useRequestFormat } from './request-format';

export function IssuesSection() {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const issues = useMyIssues();
  const items = issues.data?.pages.flatMap((p) => p.items) ?? [];
  if (items.length === 0) return null;
  return (
    <section className="hs-issues" aria-labelledby="hs-issues-title">
      <h2 id="hs-issues-title" className="hs-issues-title">
        {t('request.history.issues.title')}
      </h2>
      <ul className="hs-list">
        {items.map((i) => (
          <li key={i.id} className="hs-line">
            <div className="hs-line-head">
              <span className="hs-line-name">{fmt.name({ name: i.item_name, name_en: i.item_name_en })}</span>
              <span className="hs-line-qty">{t('request.cart.qty', { qty: i.qty, unit: fmt.unit(i.unit) })}</span>
            </div>
            <div className="hs-owed">{formatVnStamp(i.created_at, true)}</div>
            <div className="hs-line-qty">{i.note}</div>
          </li>
        ))}
      </ul>
      {issues.hasNextPage && (
        <button type="button" className="btn hs-more" disabled={issues.isFetchingNextPage} onClick={() => void issues.fetchNextPage()}>
          {t('request.history.more')}
        </button>
      )}
    </section>
  );
}
