import { useTranslation } from 'react-i18next';
import { vnSavedStamp } from '@/lib/format-time';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { useCurrentPeriod, useMyRequest, type RequestView } from './request.api';
import { AdjustmentsBlock, RemovedAllNote } from './history-adjustments';
import { Chip, ReviewTag } from './history-chip';
import { HistoryLines, LastReceived, WaitingCell } from './history-lines';
import { noteText } from './history-notes';
import { isSuspendedLine, receiveRows, receiveSummary } from './receive-rows';
import { CUSTOM_STATUSES } from './history.api';
import { useRequestFormat } from './request-format';
import { Link } from 'react-router-dom';
import { requestStatusText } from '@/lib/request-status';
import { linesStatus } from './line-status';

const titleOf = (t: ReturnType<typeof useTranslation>['t'], ym: string) =>
  t('request.history.detailTitle', { month: Number(ym.slice(5)), year: ym.slice(0, 4) });

function Table({ view, ym }: { view: RequestView; ym: string }) {
  const { t, i18n } = useTranslation();
  const fmt = useRequestFormat();
  const narrow = useMediaQuery(NARROW_QUERY);
  const rows = receiveRows(view, t, i18n.language);
  const lineById = new Map(view.lines.map((l) => [l.id, l]));
  // Dòng ngoài danh mục còn chờ xem / bị từ chối không có hàng: vẫn liệt kê kèm nhãn của Adm D&E
  const held = view.lines.filter((l) => l.review_status === 'pending' || l.review_status === 'rejected');
  if (narrow) return <HistoryLines label={titleOf(t, ym)} rows={rows} held={held} lineById={lineById} unit={fmt.unit} />;
  // "Được giao" chỉ có nghĩa khi khác số đăng ký (Adm D&E điều chỉnh, hủy phần còn lại); bằng nhau cả tháng thì bỏ cột
  const showGive = rows.some((r) => r.toGive !== r.registered);
  const heads = ['colItem', 'colUnit', 'colRegistered', ...(showGive ? ['colToGive'] : []), 'colReceived', 'colWaiting', 'colLast'];
  return (
    <table className="rq-recv-table hs-table">
      {/* Bề rộng cột đặt ở history.m1.css: đổi tháng thì cột không co giãn theo chữ, cột Món nhận phần còn lại */}
      <colgroup>
        <col />
        <col className="hs-c-unit" />
        <col className="hs-c-reg" />
        {showGive && <col className="hs-c-give" />}
        <col className="hs-c-recv" />
        <col className="hs-c-wait" />
        <col className="hs-c-last" />
      </colgroup>
      <thead>
        <tr>
          {heads.map((k) => (
            <th key={k} scope="col">
              {t(`request.receive.${k}`)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const line = lineById.get(r.id);
          const note = noteText(r, line, t);
          return (
            <tr key={r.id}>
              <th scope="row" className="rq-recv-name">
                {r.name}
                {line && <ReviewTag line={line} />}
                {note && <small>{note}</small>}
              </th>
              <td>{fmt.unit(r.unit)}</td>
              <td className="num">{r.registered}</td>
              {showGive && <td className="num">{r.toGive}</td>}
              <td className="num">{r.received}</td>
              <td className="num"><WaitingCell row={r} /></td>
              <td className="hs-note"><LastReceived row={r} /></td>
            </tr>
          );
        })}
        {held.map((l) => (
          <tr key={l.id}>
            <th scope="row" className="rq-recv-name">
              {l.custom_name ?? ''}
              <ReviewTag line={l} />
            </th>
            <td>{fmt.unit(l.custom_unit)}</td>
            <td className="num">{l.qty}</td>
            {showGive && <td className="num">–</td>}
            <td className="num">–</td>
            <td className="num">–</td>
            <td className="hs-note">–</td>
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
  const status = linesStatus(catalog);
  const custom = CUSTOM_STATUSES.map((k) => ({ k, n: view.lines.filter((l) => l.review_status === k).length })).filter((c) => c.n > 0);
  const parts = [
    t('request.history.summary', { count: catalog.length, units: t('request.unitCount', { count: catalog.reduce((n, l) => n + l.qty, 0) }) }),
    ...custom.map((c) => t(`request.history.customCount.${c.k}`, { count: c.n })),
    t('request.history.savedAt', { time: vnSavedStamp(view.saved_at) }),
  ];
  return (
    <div className="hs-d-head">
      <div>
        <Heading className="hs-d-title">{titleOf(t, ym)}</Heading>
        <p className="hs-d-sub">{parts.join(' · ')}</p>
      </div>
      {/* Cùng một cách đếm với danh sách tháng và dải nhận hàng: "Còn chờ n món" */}
      {sum.waiting > 0 ? (
        <Chip tone="warn">{t('request.history.delivery.owed', { count: sum.waiting })}</Chip>
      ) : (
        sum.total > 0 && <Chip tone={status.key === 'done' ? 'ok' : 'warn'}>{requestStatusText(t, status)}</Chip>
      )}
    </div>
  );
}

function NoRequest({ ym, level }: { ym: string; level: 1 | 2 }) {
  const { t } = useTranslation();
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <article className="hs-detail">
      <div className="hs-d-head">
        <Heading className="hs-d-title">{titleOf(t, ym)}</Heading>
      </div>
      <EmptyState
        title={t('request.history.notFound')}
        action={
          <Link className="btn" to="/">
            {t('request.history.toRegister')}
          </Link>
        }
      />
    </article>
  );
}

// Chi tiết một phiếu đã khóa (cột phải ≥ 901 px, cả trang ở điện thoại)
export function HistoryDetail({ ym, level = 2 }: { ym: string; level?: 1 | 2 }) {
  const period = useCurrentPeriod();
  const request = useMyRequest(ym);
  // Kỳ sau kỳ đang mở chưa thể có phiếu
  const future = !!period.data && ym > period.data.ym;
  if (future) return <NoRequest ym={ym} level={level} />;
  if (request.isPending || period.isPending) return <Loading />;
  if (request.isError) return <LoadError onRetry={() => void request.refetch()} />;
  const view = request.data;
  if (!view) return <NoRequest ym={ym} level={level} />;
  return (
    <article className="hs-detail">
      <Header ym={ym} view={view} level={level} />
      {view.removed_all && <RemovedAllNote view={view} />}
      <Table view={view} ym={ym} />
      <AdjustmentsBlock view={view} />
    </article>
  );
}
