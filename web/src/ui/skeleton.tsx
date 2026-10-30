import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export function Skeleton({
  shape,
  count = 1,
  delayMs = 300,
}: {
  shape: 'row' | 'stat' | 'card';
  count?: number;
  delayMs?: number;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(id);
  }, [delayMs]);
  if (!visible) return null;
  return (
    <div className={`skeleton-group skeleton-group--${shape}`} role="status" aria-busy="true" aria-label={t('common.loading')}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`skeleton skeleton--${shape}`} aria-hidden="true" />
      ))}
    </div>
  );
}
