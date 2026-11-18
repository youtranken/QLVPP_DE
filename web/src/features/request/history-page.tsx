import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { MemberPage } from '@/shell/member-page';
import { useCurrentPeriod } from './request.api';
import { useMyHistory } from './history.api';
import { HistoryDetail } from './history-detail';
import { HistoryMaster } from './history-master';
import { IssuesSection } from './issues-section';
import './history.m1.css';

export { DeliveryTag } from './history-delivery-tag';

// /history và /history/:ym: ≥ 901 px cột tháng bên trái + chi tiết bên phải; ≤ 900 px một màn mỗi lần
export function HistoryLayout({ ym }: { ym?: string }) {
  const { t } = useTranslation();
  const narrow = useMediaQuery(NARROW_QUERY);
  const history = useMyHistory();
  const period = useCurrentPeriod();
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];
  const isOpen = (v: string) => !!period.data?.is_open && period.data.ym === v;
  const closed = items.filter((i) => !isOpen(i.period_ym));
  // Chưa biết kỳ đang mở thì chưa chọn tháng mặc định (tránh GET thừa phiếu kỳ đang mở).
  // Điện thoại (không có ym) chỉ có danh sách: không chọn sẵn, nên không tháng nào bị tô như đang xem
  const latestClosed = period.isPending || narrow ? undefined : closed.find((i) => i.line_count > 0 || i.removed_all)?.period_ym;
  const selected = ym ?? latestClosed;
  // "Chưa có phiếu đã chốt" chỉ khi chắc chắn: không trang nào còn chưa tải và không có tháng đã chốt nào
  const noClosed = closed.length === 0 && !history.hasNextPage;

  if (narrow && ym) {
    const back = (
      <Link className="m-back" to="/history">
        <span aria-hidden="true">←</span> {t('request.history.back')}
      </Link>
    );
    return (
      <MemberPage back={back}>
        <HistoryDetail ym={ym} level={1} />
      </MemberPage>
    );
  }
  const loaded = !history.isPending && !history.isError && items.length > 0;
  // Chưa có lịch sử mà mở thẳng một tháng: chỉ một trạng thái rỗng (không đặt danh sách rỗng cạnh chi tiết rỗng)
  if (ym && !history.isPending && !history.isError && items.length === 0) {
    return (
      <MemberPage wide>
        <HistoryDetail ym={ym} level={1} />
      </MemberPage>
    );
  }
  const master = history.isPending ? (
    <Loading />
  ) : history.isError ? (
    <LoadError onRetry={() => void history.refetch()} />
  ) : items.length === 0 ? (
    <>
      <EmptyState
        title={t('request.history.empty')}
        hint={t('request.history.emptyHint')}
        action={
          <Link className="btn btn--primary" to="/">
            {t('request.history.toRegister')}
          </Link>
        }
      />
      <IssuesSection />
    </>
  ) : (
    <HistoryMaster
      items={items}
      selected={selected}
      isOpen={isOpen}
      chevron={narrow}
      hasMore={!!history.hasNextPage}
      loadingMore={history.isFetchingNextPage}
      onMore={() => void history.fetchNextPage()}
    />
  );
  // Đã chọn một tháng (URL) thì chi tiết hiện dù danh sách bên trái lỗi/chưa tải
  const split = !narrow && (!!ym || loaded);
  return (
    <MemberPage wide title={t('request.history.title')} subtitle={t('request.history.subtitle')}>
      {split ? (
        <div className="hs-split">
          {master}
          <div className="hs-pane">
            {selected ? (
              <HistoryDetail ym={selected} />
            ) : period.isPending ? (
              <Loading />
            ) : noClosed ? (
              <EmptyState title={t('request.history.noClosed')} hint={t('request.history.noClosedHint')} />
            ) : (
              <EmptyState title={t('request.history.pickMonth')} />
            )}
          </div>
        </div>
      ) : (
        master
      )}
    </MemberPage>
  );
}

export function HistoryPage() {
  return <HistoryLayout />;
}
