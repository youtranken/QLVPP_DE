import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SendState } from '@/features/send-adm/use-send-state';
import { reportStatus } from './report-status';

interface Props {
  send: SendState;
  rowsChanged: number;
  pendingCustom: number;
  ym: string;
  onReprint?: () => void;
  reprinting?: boolean;
}

// Nằm trên hàng tiêu đề, ngay trước Xuất Excel (vòng 4 mục 9), chấm tròn theo tone
export function ReportStatusLine({ send, rowsChanged, pendingCustom, ym, onReprint, reprinting = false }: Props) {
  const { t } = useTranslation();
  const { tone, parts } = reportStatus(send, rowsChanged, pendingCustom, t);
  return (
    <span className="bc-status bc-status--inline" role="status" data-tone={tone}>
      {parts.map((p, i) => (
        <span key={i}>{i > 0 && ' · '}{p}</span>
      ))}
      {pendingCustom > 0 && (
        <>
          {' · '}
          <Link to={`/admin/review?status=pending&ym=${ym}`}>{t('reports.send.status.customLink')}</Link>
        </>
      )}
      {send.state === 'sent' && onReprint && (
        <>
          {' · '}
          <button type="button" className="sa-link" disabled={reprinting} onClick={onReprint}>
            {t('reports.send.status.reprint')}
          </button>
        </>
      )}
    </span>
  );
}
