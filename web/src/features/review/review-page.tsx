import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { useToast } from '@/ui/toast-context';
import { useAdminItems } from '@/features/catalog/catalog.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { REVIEW_FILTERS, useReviewCache, useReviewCounts, useReviewLines, type ReviewBody, type ReviewFilter, type ReviewResult, type ReviewRow } from './review.api';
import { ReviewCard } from './review-card';
import { ReviewPeriod } from './review-period';
import { useReviewParams } from './use-review-params';
import './review.m1.css';

// Dòng đã thêm vào danh mục không còn custom_name: lấy tên món đích
function useItemNames() {
  const items = useAdminItems();
  return useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i.name])), [items.data]);
}

export function ReviewPage() {
  const { t } = useTranslation();
  const p = useReviewParams();
  const current = useCurrentPeriod();
  const list = useReviewLines(p.status, p.ym);
  const counts = useReviewCounts(p.ym);
  const cache = useReviewCache();
  const toast = useToast();
  const itemNames = useItemNames();
  const [staleNotice, setStaleNotice] = useState(false);
  const [handled, setHandled] = useState<string[]>([]);
  const rowName = (row: ReviewRow) => row.custom_name ?? (row.item_id ? itemNames.get(row.item_id) : undefined) ?? '';

  const change = (next: () => void) => {
    setStaleNotice(false);
    setHandled([]);
    next();
  };

  const done = (row: ReviewRow, name: string, result: ReviewResult, body: ReviewBody) => {
    setHandled((ids) => [...ids, row.line_id]);
    void cache.markListStale();
    void cache.refreshOtherTabs(p.status);
    const status = result.line.review_status;
    const text =
      body.action === 'convert' && 'existing_id' in body.item
        ? t('review.toast.linked', { name, item: itemNames.get(body.item.existing_id) ?? '' })
        : t(`review.toast.${status === 'converted' ? 'converted' : status}`, { name });
    // Toast hiện một cái một lúc: cảnh báo ĐVT đi chung câu kết quả
    toast.show(
      result.unit_mismatch
        ? { tone: 'warn', text: `${text} ${t('review.actions.unitMismatch', { qty: result.line.qty })}` }
        : { text },
    );
  };

  // Thẻ vừa xử lý ở lại trong tab Chờ xem nhưng không còn là "chờ xem" nữa
  const stillListed = handled.filter((id) => list.data?.items.some((r) => r.line_id === id)).length;
  const countOf = (f: ReviewFilter) => {
    const n = counts[f];
    return f === 'pending' && p.status === 'pending' && n !== undefined ? n - stillListed : n;
  };
  const tabs = REVIEW_FILTERS.map((f) => ({ value: f, label: t(`review.filters.${f}`), count: countOf(f) }));

  return (
    <div className="ct-page">
      <PageHeader
        crumbs={[t('nav.groups.monthly'), t('nav.review')]}
        title={t('nav.review')}
        description={t('review.page.description')}
      />
      <div className="toolbar">
        <ReviewPeriod ym={p.ym} openYm={current.data?.ym} onChange={(v) => change(() => p.setMonth(v))} />
      </div>
      <div className="ct-block">
        <div className="toolbar rv-tabs">
          <Segmented label={t('review.filters.label')} value={p.status} options={tabs} onChange={(s) => change(() => p.setStatus(s))} />
        </div>
        <p className="rv-note">{t('review.page.note')}</p>
      </div>
      {staleNotice && (
        <p role="status" className="alert alert--warn">
          {t('review.staleNotice')}
        </p>
      )}
      {list.isError ? (
        <LoadError onRetry={() => void list.refetch()} />
      ) : list.isPending ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          art="no-match"
          title={t(`review.empty.${p.status}`)}
          action={
            p.status === 'pending' ? (
              <button type="button" className="btn" onClick={() => change(() => p.setStatus('accepted'))}>
                {t('review.empty.pendingAction')}
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="rv-grid">
          {list.data.items.map((row) => (
            <ReviewCard
              key={row.line_id}
              row={row}
              name={rowName(row)}
              onDone={(result, body) => done(row, rowName(row), result, body)}
              onStale={() => setStaleNotice(true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
