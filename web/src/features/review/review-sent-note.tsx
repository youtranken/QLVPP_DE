import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatVnStamp } from '@/lib/format-time';
import type { SentInfo, SentKind } from './review-sent';

export function SentNote({ sent, kind, unit }: { sent: SentInfo & { at: string }; kind: SentKind; unit: string }) {
  const { t } = useTranslation();
  const time = formatVnStamp(sent.at);
  if (kind === 'skip') return <>{t('warn.W10a', { time, n: sent.qty, unit })}</>;
  return (
    <>
      {t('warn.W10b', { time })} <Link to="/admin/send-adm">{t('review.sentLink')}</Link>
    </>
  );
}
