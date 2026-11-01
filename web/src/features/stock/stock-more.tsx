import { useTranslation } from 'react-i18next';

export function StockMore({ shown, total, hidden, onMore }: { shown: number; total: number; hidden: number; onMore: () => void }) {
  const { t } = useTranslation();
  if (hidden === 0) return null;
  return (
    <div className="sk-more">
      <p className="sk-more__count">{t('stock.page.shown', { shown, total })}</p>
      <button type="button" className="btn" onClick={onMore}>
        {t('stock.page.showMore', { n: hidden })}
      </button>
    </div>
  );
}
