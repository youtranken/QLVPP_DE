import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SendState } from '@/features/send-adm/use-send-state';
import { reportStatus } from './report-status';

interface Props {
  send: SendState;
  rowsChanged: number;
  pendingCustom: number;
  ym: string;
}

// Dấu chấm chỉ để nhìn; điện thoại ẩn đi (dùng khoảng cách) để không đứng lẻ đầu dòng khi xuống dòng
const Sep = () => (
  <span className="bc-status__sep" aria-hidden="true">
    ·
  </span>
);

// Trên thanh công cụ, ngay trước Xuất Excel, chấm tròn theo tone; in lại từng bản ở "Các bản đã in / xuất"
export function ReportStatusLine({ send, rowsChanged, pendingCustom, ym }: Props) {
  const { t } = useTranslation();
  const { tone, parts } = reportStatus(send, rowsChanged, t);
  return (
    <span className="bc-status bc-status--inline" role="status" data-tone={tone}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <Sep />}
          <span>{p}</span>
        </Fragment>
      ))}
      {pendingCustom > 0 && (
        <>
          <Sep />
          <Link to={`/admin/review?status=pending&ym=${ym}`} aria-label={t('reports.send.status.customLabel', { n: pendingCustom })}>
            {t('reports.send.status.customLink')}
          </Link>
        </>
      )}
    </span>
  );
}
