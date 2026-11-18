import { useTranslation } from 'react-i18next';

export function StockMore({ hidden, onMore }: { hidden: number; onMore: () => void }) {
  const { t } = useTranslation();
  if (hidden === 0) return null;
  return (
    <div className="sk-more">
      <button type="button" className="btn" onClick={onMore}>
        {t('stock.page.showMore', { n: hidden })}
      </button>
    </div>
  );
}
