import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api-client';
import { apiErrorCode } from '@/lib/api-error';
import { LoadError, Loading, NotFound } from '@/ui/load-state';
import { IconSprite } from '@/ui/icon-sprite';
import { useShellFont } from '@/shell/use-shell-font';
import { useSnapshot, type SnapshotData } from './reports.api';
import { hasItems } from './print-format';
import { PrintRequestForm } from './print-request-form';
import { PendingScreen, Toolbar } from './print-toolbar';
import { usePageStyle } from './print-page-style';
import './print.m1.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function EmptySnapshot() {
  const { t } = useTranslation();
  return (
    <p role="status" className="alert pp-empty-snap">
      {t('reports.print.emptySnapshot')}
    </p>
  );
}

// Bản in chỉ có Phiếu đề xuất; phụ lục chi tiết chỉ còn trong Excel (link cũ ?appendix=1 bị bỏ qua)
function PrintScreen({ snap }: { snap: SnapshotData }) {
  // Bản rỗng cũ: không có gì để trình ký
  const empty = !hasItems(snap);
  return (
    <div className="pp-page">
      <Toolbar snap={snap} empty={empty} />
      {empty ? (
        <EmptySnapshot />
      ) : (
        // Màn hẹp hơn tờ: tờ giữ bề rộng, cuộn ngang trong khung riêng (không để bảng tự co, trang không cuộn ngang)
        <div className="pp-sheet-scroll">
          <PrintRequestForm snap={snap} />
        </div>
      )}
    </div>
  );
}

function PrintContent() {
  const { id = '' } = useParams();
  const valid = UUID.test(id);
  const query = useSnapshot(id, valid);
  if (!valid) return <NotFound />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 401) return <PendingScreen><Loading /></PendingScreen>;
    if (apiErrorCode(query.error) === 'SNAPSHOT_NOT_FOUND') return <NotFound />;
    return <PendingScreen><LoadError onRetry={() => void query.refetch()} /></PendingScreen>;
  }
  if (!query.data) return <PendingScreen><Loading /></PendingScreen>;
  return <PrintScreen snap={query.data} />;
}

export function PrintPage() {
  useShellFont('admin');
  usePageStyle();
  return (
    <>
      <IconSprite />
      <PrintContent />
    </>
  );
}
