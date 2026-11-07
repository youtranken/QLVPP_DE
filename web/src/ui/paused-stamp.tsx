import { useTranslation } from 'react-i18next';
import './paused-stamp.css';

export function PausedStamp({ label }: { label?: string }) {
  const { t } = useTranslation();
  const text = label ?? t('common.paused');
  return (
    <span className="paused-stamp" role="img" aria-label={text}>
      {text}
    </span>
  );
}
