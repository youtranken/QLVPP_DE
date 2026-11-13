import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loading } from '@/ui/load-state';
import { Icon } from '@/ui/icon';
import { IconSprite } from '@/ui/icon-sprite';
import { useShellFont } from '@/shell/use-shell-font';
import { monthOf } from '@/features/request/request-format';
import type { SnapshotData } from './reports.api';
import { vnStampParts } from './print-format';

// Thanh công cụ + khung chờ của trang in nằm ở chunk chính: lúc chunk "print" còn đang nạp, khung chờ y như lúc
// trang đang tải bản chốt (không nhảy bố cục khi trang thật thay vào)

// Quay lại luôn về Báo cáo & gửi ADM của tháng bản chốt
const backPath = (ym: string) => `/admin/reports?ym=${ym}`;

// snap chưa có (đang tải hoặc lỗi): vẫn giữ thanh công cụ — Quay lại về Báo cáo, nút In khóa
export function Toolbar({ snap, empty }: { snap?: SnapshotData; empty: boolean }) {
  const { t } = useTranslation();
  const at = snap && vnStampParts(snap.created_at);
  const back = snap ? backPath(snap.period_ym) : '/admin/reports';
  return (
    <div role="toolbar" aria-label={t('reports.print.toolbar.label')} className="pp-toolbar">
      <Link className="btn btn--ghost" to={back}>
        <Icon name="back" size={18} />
        {t('reports.print.toolbar.back')}
      </Link>
      <span className="pp-toolbar__text">
        {snap && at
          ? t('reports.print.toolbar.summary', { month: monthOf(snap.period_ym), year: snap.period_ym.slice(0, 4), at: `${at.time} ${at.dayMonth}` })
          : t('reports.print.toolbar.pending')}
      </span>
      <button type="button" className="btn btn--primary" disabled={empty} onClick={() => window.print()}>
        <Icon name="printer" size={18} />
        {t('reports.print.toolbar.print')}
      </button>
    </div>
  );
}

// Đang tải / lỗi: giữ thanh công cụ, chỉ vùng tờ in đổi sang trạng thái
export function PendingScreen({ children }: { children: ReactNode }) {
  return (
    <div className="pp-page">
      <Toolbar empty />
      {children}
    </div>
  );
}

// Khung chờ khi chunk trang in chưa nạp xong (cùng font, sprite, thanh công cụ như PrintPage)
export function PrintPending() {
  useShellFont('admin');
  return (
    <>
      <IconSprite />
      <PendingScreen>
        <Loading />
      </PendingScreen>
    </>
  );
}
