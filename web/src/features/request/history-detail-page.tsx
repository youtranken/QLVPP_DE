import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadError, Loading, NotFound } from '@/ui/load-state';
import { useCurrentPeriod, useMyRequest, type LineView } from './request.api';
import { useRequestFormat } from './request-format';
import { LineProgress } from './line-progress';
import { ItemThumb } from '@/ui/item-thumb';
import { MemberPage } from '@/shell/member-page';
import { Chip } from './history-chip';
import './history.m1.css';
import { YM } from '@/lib/ym';

const EFFECTIVE = ['n/a', 'accepted', 'converted'];

function ReviewTag({ line }: { line: LineView }) {
  const { t } = useTranslation();
  const s = line.review_status;
  if (s === 'n/a') return null;
  if (s === 'rejected') {
    const reason = line.review_note?.trim();
    return <Chip tone="danger">{reason ? t('request.history.review.rejectedWhy', { reason }) : t('request.history.review.rejected')}</Chip>;
  }
  return <Chip tone={s === 'pending' ? 'warn' : 'ok'}>{t(`request.history.review.${s}`)}</Chip>;
}

function DetailLine({ line }: { line: LineView }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = line.item ? fmt.name(line.item) : (line.custom_name ?? '');
  const unit = fmt.unit(line.item?.unit ?? line.custom_unit);
  const effective = EFFECTIVE.includes(line.review_status);
  const owed = line.qty - line.delivered_qty - line.cancelled_qty;
  const reason = line.cancel_note?.trim();
  const base = line.cancelled_qty >= line.qty ? 'cancelledAll' : 'cancelled';
  const cancelText = reason
    ? t(`request.history.${base}Why`, { n: line.cancelled_qty, reason })
    : t(`request.history.${base}`, { n: line.cancelled_qty });
  return (
    <li className="hs-card hs-line">
      <ItemThumb fileId={line.item?.image_file_id ?? line.image_file_id} alt="" tone="g0" size={42} />
      <div className="hs-line-body">
        <div className="hs-line-head">
          <span className="hs-item-name">{name}</span>
          {!line.item_id && <Chip tone="open">{t('request.cart.custom')}</Chip>}
          <ReviewTag line={line} />
        </div>
        <div className="hs-item-qty">{t('request.cart.qty', { qty: line.qty, unit })}</div>
        {effective && <LineProgress delivered={line.delivered_qty} qty={line.qty} cancelled={line.cancelled_qty} />}
        {effective && owed > 0 && <div className="hs-owed">{t('request.history.owed', { n: owed })}</div>}
        {effective && line.cancelled_qty > 0 && <div className="hs-cancelled">{cancelText}</div>}
      </div>
    </li>
  );
}

export function HistoryDetailPage() {
  const { t } = useTranslation();
  const { ym = '' } = useParams();
  const valid = YM.test(ym);
  const period = useCurrentPeriod();
  const request = useMyRequest(valid ? ym : undefined);
  if (!valid) return <MemberPage><NotFound /></MemberPage>;
  // Kỳ đang mở sửa được ở trang Đăng ký, không có bản chỉ đọc
  if (period.data?.is_open && period.data.ym === ym) return <Navigate to="/" replace />;
  // Kỳ sau kỳ đang mở chưa thể có phiếu → khỏi gọi api rồi nhận INVALID_PERIOD
  const future = !!period.data && ym > period.data.ym;
  const back = (
    <Link className="m-back" to="/history">
      <span aria-hidden="true">←</span> {t('request.history.back')}
    </Link>
  );
  return (
    <MemberPage back={back} title={t('request.history.detailTitle', { month: Number(ym.slice(5)), year: ym.slice(0, 4) })}>
      {future ? (
        <EmptyState title={t('request.history.notFound')} />
      ) : request.isPending || period.isPending ? (
        <Loading />
      ) : request.isError ? (
        <LoadError onRetry={() => void request.refetch()} />
      ) : !request.data ? (
        <EmptyState title={t('request.history.notFound')} />
      ) : (
        <ul className="hs-list">
          {request.data.lines.map((l) => (
            <DetailLine key={l.id} line={l} />
          ))}
        </ul>
      )}
    </MemberPage>
  );
}
