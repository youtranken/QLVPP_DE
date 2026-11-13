import { useTranslation } from 'react-i18next';
import { formatVnStamp, vnSavedStamp } from '@/lib/format-time';
import { EmptyValue } from '@/ui/empty-cell';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { useCurrentPeriod, useMyRequest, type LineView, type RequestView } from './request.api';
import { AdjustmentsBlock, RemovedAllNote } from './history-adjustments';
import { Chip, ReviewTag } from './history-chip';
import { ReceiveStatus } from './receive-dialog';
import { isSuspendedLine, receiveRows, receiveSummary, type ReceiveRow } from './receive-rows';
import { CUSTOM_STATUSES } from './history.api';
import { useRequestFormat } from './request-format';

function cancelNote(l: LineView, t: ReturnType<typeof useTranslation>['t']): string | null {
  if (l.cancelled_qty <= 0) return null;
  const reason = l.cancel_note?.trim();
  const base = l.cancelled_qty >= l.qty ? 'cancelledAll' : 'cancelled';
  return reason ? t(`request.history.${base}Why`, { n: l.cancelled_qty, reason }) : t(`request.history.${base}`, { n: l.cancelled_qty });
}

type T = ReturnType<typeof useTranslation>['t'];

function noteParts(row: ReceiveRow, line: LineView | undefined, t: T): string[] {
  const parts: string[] = [];
  if (row.reason) parts.push(t('request.history.removedNote', { reason: row.reason }));
  if (row.received > 0 && row.receivedAt) parts.push(t('request.history.receivedAt', { at: formatVnStamp(row.receivedAt) }));
  const cancelled = line ? cancelNote(line, t) : null;
  if (cancelled) parts.push(cancelled);
  return parts;
}

// Ô Ghi chú có gì để hiện: dòng chữ hoặc nhãn duyệt món ngoài danh mục (ReviewTag trả null cho món trong danh mục)
const hasNote = (row: ReceiveRow, line: LineView | undefined, t: T) => noteParts(row, line, t).length > 0 || (!!line && line.review_status !== 'n/a');

function NoteCell({ row, line }: { row: ReceiveRow; line: LineView | undefined }) {
  const { t } = useTranslation();
  const parts = noteParts(row, line, t);
  return (
    <>
      {parts.map((p, i) => (
        <span key={p}>
          {i > 0 && ' · '}
          {p}
        </span>
      ))}
      {line && <ReviewTag line={line} />}
    </>
  );
}

function Table({ view }: { view: RequestView }) {
  const { t, i18n } = useTranslation();
  const fmt = useRequestFormat();
  const rows = receiveRows(view, t, i18n.language);
  const lineById = new Map(view.lines.map((l) => [l.id, l]));
  // Dòng ngoài danh mục còn chờ xem / bị từ chối không có hàng: vẫn liệt kê kèm nhãn của Hành chính
  const held = view.lines.filter((l) => l.review_status === 'pending' || l.review_status === 'rejected');
  // Cột Ghi chú luôn có (bỏ cột khi cả tháng trống làm mọi cột dời khi đổi tháng); ô trống hiện "—" như mọi ô trống khác,
  // dạng thẻ điện thoại ẩn cả ô (td[data-empty]) để không còn nhãn "Ghi chú:" trơ trọi
  return (
    <table className="rq-recv-table hs-table">
      {/* Bề rộng cột đặt ở history.m1.css (theo bề rộng màn): đổi tháng thì cột không co giãn theo chữ, cột Món nhận phần còn lại */}
      <colgroup>
        <col />
        <col className="hs-c-unit" />
        <col className="hs-c-reg" />
        <col className="hs-c-give" />
        <col className="hs-c-recv" />
        <col className="hs-c-st" />
        <col className="hs-c-note" />
      </colgroup>
      <thead>
        <tr>
          {['colItem', 'colUnit', 'colRegistered', 'colToGive', 'colReceived', 'colStatus'].map((k) => (
            <th key={k} scope="col">
              {t(`request.receive.${k}`)}
            </th>
          ))}
          <th scope="col">{t('request.history.colNote')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <th scope="row" className="rq-recv-name">
              {r.name}
            </th>
            <td data-label={t('request.receive.colUnit')}>{fmt.unit(r.unit)}</td>
            <td data-label={t('request.receive.colRegistered')} className="num">{r.registered}</td>
            <td data-label={t('request.receive.colToGive')} className="num">{r.toGive}</td>
            <td data-label={t('request.receive.colReceived')} className="num">{r.received}</td>
            <td data-label={t('request.receive.colStatus')}><ReceiveStatus row={r} /></td>
            {hasNote(r, lineById.get(r.id), t) ? (
              <td data-label={t('request.history.colNote')} className="hs-note">
                <NoteCell row={r} line={lineById.get(r.id)} />
              </td>
            ) : (
              <td data-label={t('request.history.colNote')} className="hs-note" data-empty="">
                <EmptyValue />
              </td>
            )}
          </tr>
        ))}
        {held.map((l) => (
          <tr key={l.id}>
            <th scope="row" className="rq-recv-name">
              {l.custom_name ?? ''}
            </th>
            <td data-label={t('request.receive.colUnit')}>{fmt.unit(l.custom_unit)}</td>
            <td data-label={t('request.receive.colRegistered')} className="num">{l.qty}</td>
            <td data-label={t('request.receive.colToGive')} className="num">–</td>
            <td data-label={t('request.receive.colReceived')} className="num">–</td>
            <td data-label={t('request.receive.colStatus')} />
            <td data-label={t('request.history.colNote')} className="hs-note"><ReviewTag line={l} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Header({ ym, view, level }: { ym: string; view: RequestView; level: 1 | 2 }) {
  const { t, i18n } = useTranslation();
  const Heading = level === 1 ? 'h1' : 'h2';
  // Một luật với cột trái (catalog của API): chỉ dòng món trong danh mục, không tạm ngưng, số lượng hiện tại
  // (sau điều chỉnh của Adm D&E); món ngoài danh mục ghi phần riêng, không cộng vào số món/đơn vị/chip giao
  const catalog = view.lines.filter((l) => l.review_status === 'n/a' && !isSuspendedLine(l));
  const catalogIds = new Set(catalog.map((l) => l.id));
  const sum = receiveSummary(receiveRows(view, t, i18n.language).filter((r) => catalogIds.has(r.id)));
  const custom = CUSTOM_STATUSES.map((k) => ({ k, n: view.lines.filter((l) => l.review_status === k).length })).filter((c) => c.n > 0);
  const parts = [
    t('request.history.summary', { count: catalog.length, units: t('request.unitCount', { count: catalog.reduce((n, l) => n + l.qty, 0) }) }),
    ...custom.map((c) => t(`request.history.customCount.${c.k}`, { count: c.n })),
    t('request.history.savedAt', { time: vnSavedStamp(view.saved_at) }),
    view.department,
  ].filter(Boolean);
  return (
    <div className="hs-d-head">
      <div>
        <Heading className="hs-d-title">{t('request.history.detailTitle', { month: Number(ym.slice(5)), year: ym.slice(0, 4) })}</Heading>
        <p className="hs-d-sub">{parts.join(' · ')}</p>
      </div>
      {sum.total > 0 && (
        <Chip tone={sum.waiting > 0 ? 'warn' : 'ok'}>
          {sum.waiting > 0 ? t('request.history.chipDelivering', { done: sum.done, total: sum.total, count: sum.total }) : t('request.history.delivery.done')}
        </Chip>
      )}
    </div>
  );
}

// Chi tiết một phiếu đã khóa (cột phải ≥ 901 px, cả trang ở điện thoại)
export function HistoryDetail({ ym, level = 2 }: { ym: string; level?: 1 | 2 }) {
  const { t } = useTranslation();
  const period = useCurrentPeriod();
  const request = useMyRequest(ym);
  // Kỳ sau kỳ đang mở chưa thể có phiếu
  const future = !!period.data && ym > period.data.ym;
  if (future) return <EmptyState title={t('request.history.notFound')} />;
  if (request.isPending || period.isPending) return <Loading />;
  if (request.isError) return <LoadError onRetry={() => void request.refetch()} />;
  const view = request.data;
  if (!view) return <EmptyState title={t('request.history.notFound')} />;
  return (
    <article className="hs-detail">
      <Header ym={ym} view={view} level={level} />
      {view.removed_all && <RemovedAllNote view={view} />}
      <Table view={view} />
      <AdjustmentsBlock view={view} />
    </article>
  );
}
