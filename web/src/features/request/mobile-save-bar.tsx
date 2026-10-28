import { useTranslation } from 'react-i18next';

export function MobileSaveBar({
  count,
  label,
  canSave,
  onSave,
}: {
  count: number;
  label: string;
  canSave: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rq-bar">
      <b className="num">{t('request.cart.count', { n: count })}</b>
      <button type="button" className="btn btn--primary btn--lg" disabled={!canSave} onClick={onSave}>
        {label}
      </button>
    </div>
  );
}
