import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadError, Loading, NotFound } from '@/ui/load-state';
import { useCurrentPeriod, useMyRequest, type LineView } from './request.api';
import { useRequestFormat } from './request-format';
import { LineProgress } from './line-progress';
import './history.css';

const YM = /^\d{4}-(0[1-9]|1[0-2])$/;
const EFFECTIVE = ['n/a', 'accepted', 'converted'];

function ReviewTag({ line }: { line: LineView }) {
  const { t } = useTranslation();
  const s = line.review_status;
  if (s === 'n/a') return null;
  if (s === 'rejected') {
    const reason = line.review_note?.trim();
    return <span className="tag tag--danger">{reason ? t('request.history.review.rejectedWhy', { reason }) : t('request.history.review.rejected')}</span>;
  }
  return <span className={`tag ${s === 'pending' ? 'tag--warn' : 'tag--ok'}`}>{t(`request.history.review.${s}`)}</span>;
}

function DetailLine({ line }: { line: LineView }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = line.item ? fmt.name(line.item) : (line.custom_name ?? '');
  const unit = fmt.unit(line.item?.unit ?? line.custom_unit);
  const effective = EFFECTIVE.includes(line.review_status);
  return (
    <li className="hs-line">
      <div className="hs-line-head">
        <span className="hs-line-name">{name}</span>
        {!line.item_id && <span className="tag tag--info">{t('request.cart.custom')}</span>}
        <ReviewTag line={line} />
      </div>
      <div className="hs-line-qty">{t('request.cart.qty', { qty: line.qty, unit })}</div>
      {effective && <LineProgress delivered={line.delivered_qty} qty={line.qty} />}
      {effective && line.cancelled_qty > 0 && (
        <div className="hs-cancelled">{t('request.history.cancelled', { n: line.cancelled_qty })}</div>
      )}
    </li>
  );
}

export function HistoryDetailPage() {
  const { t } = useTranslation();
  const { ym = '' } = useParams();
  const valid = YM.test(ym);
  const period = useCurrentPeriod();
  const request = useMyRequest(valid ? ym : undefined);
  if (!valid) return <NotFound />;
  // Kỳ đang mở sửa được ở trang Đăng ký, không có bản chỉ đọc
  if (period.data?.is_open && period.data.ym === ym) return <Navigate to="/" replace />;
  const back = (
    <Link className="hs-back" to="/history">
      ← {t('request.history.back')}
    </Link>
  );
  return (
    <div className="hs-page">
      {back}
      <h1 className="page-title">{t('request.history.detailTitle', { month: Number(ym.slice(5)), year: ym.slice(0, 4) })}</h1>
      {request.isPending || period.isPending ? (
        <Loading />
      ) : request.isError ? (
        <LoadError onRetry={() => void request.refetch()} />
      ) : !request.data ? (
        <EmptyState title={t('request.history.notFound')} />
      ) : (
        <ul className="hs-lines">
          {request.data.lines.map((l) => (
            <DetailLine key={l.id} line={l} />
          ))}
        </ul>
      )}
    </div>
  );
}
