import { useTranslation } from 'react-i18next';

export function IssueHeldNote({ waiting, qty, took, unit }: { waiting: number; qty: number; took: number; unit: string }) {
  const { t } = useTranslation();
  return (
    <div role="note" className="alert alert--warn sk-held-note">
      <span>{t('warn.W21', { k: waiting })}</span>
      <small>{t('warn.W21take', { q: qty, x: took, unit })}</small>
    </div>
  );
}
