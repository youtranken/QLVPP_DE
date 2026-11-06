import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { PageHeader } from '@/ui/page-header';
import { clearNoOrder, useRefreshSendState } from './send-adm.api';

interface Props {
  head: { crumbs: string[]; title: string; description: string };
  ym: string;
  noOrder: { at: string; by: string | null };
}

// Kỳ đã đánh dấu không cần đề nghị: "Lập phiếu" xóa cờ để quay lại lập phiếu
export function SendAdmNoOrder({ head, ym, noOrder }: Props) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const refresh = useRefreshSendState(ym);
  const flight = useSingleFlight();
  const [failed, setFailed] = useState(false);
  const reopen = () =>
    flight.run(async () => {
      setFailed(false);
      try {
        await clearNoOrder(ym, csrfToken);
        await refresh();
      } catch {
        setFailed(true);
      }
    });
  return (
    <div className="ct-page sa-page">
      <PageHeader
        {...head}
        primary={
          <button type="button" className="btn btn--primary" disabled={flight.pending} onClick={() => void reopen()}>
            {t('sendAdm.noOrder.reopen')}
          </button>
        }
      />
      <p className="alert alert--ok sa-banner">{t('sendAdm.noOrder.banner', { time: formatVnStamp(noOrder.at), name: noOrder.by ?? '' })}</p>
      {failed && <p role="alert" className="alert alert--danger">{t('sendAdm.noOrder.failed')}</p>}
    </div>
  );
}
