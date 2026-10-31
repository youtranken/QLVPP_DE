import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { useToast } from '@/ui/toast-context';
import { useAdminItems } from '@/features/catalog/catalog.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { REVIEW_FILTERS, useReviewCache, useReviewCounts, useReviewLines, type ReviewBody, type ReviewResult, type ReviewRow } from './review.api';
import { ReviewCard } from './review-card';
import { useReviewParams } from './use-review-params';
import '@/features/admin/admin.css';
import './review.m1.css';

const MONTHS_BACK = 12;

// Cùng mẫu với api/src/common/ym.ts
function recentMonths(openYm: string | undefined): string[] {
  if (!openYm) return [];
  const [y, m] = openYm.split('-').map(Number);
  return Array.from({ length: MONTHS_BACK }, (_, i) => {
    const at = y * 12 + (m - 1) - i;
    return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`;
  });
}

// Dòng đã thêm vào danh mục không còn custom_name: lấy tên món đích
function useItemNames() {
  const items = useAdminItems();
  return useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i.name])), [items.data]);
}

export function ReviewPage() {
  const { t } = useTranslation();
  const p = useReviewParams();
  const current = useCurrentPeriod();
  const months = recentMonths(current.data?.ym);
  const list = useReviewLines(p.status, p.ym);
  const counts = useReviewCounts(p.ym);
  const cache = useReviewCache();
  const toast = useToast();
  const itemNames = useItemNames();
  const [staleNotice, setStaleNotice] = useState(false);
  const rowName = (row: ReviewRow) => row.custom_name ?? (row.item_id ? itemNames.get(row.item_id) : undefined) ?? '';

  const change = (next: () => void) => {
    setStaleNotice(false);
    next();
  };

  const done = (name: string, result: ReviewResult, body: ReviewBody) => {
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

  const tabs = REVIEW_FILTERS.map((f) => ({ value: f, label: t(`review.filters.${f}`), count: counts[f] }));

  return (
    <div className="rv-page">
      <PageHeader
        crumbs={[t('nav.groups.monthly'), t('nav.review')]}
        title={t('nav.review')}
        description={t('review.page.description')}
        actions={
          <label className="rv-period">
            <span>{t('review.period')}</span>
            <select className="a-input" value={p.ym} onChange={(e) => change(() => p.setMonth(e.target.value))}>
              <option value="">{t('review.allPeriods')}</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {t('review.month', { month: Number(m.slice(5)), year: m.slice(0, 4) })}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div className="rv-tabs">
        <Segmented label={t('review.filters.label')} value={p.status} options={tabs} onChange={(s) => change(() => p.setStatus(s))} />
      </div>
      <p className="rv-note">{t('review.page.note')}</p>
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
              onDone={(result, body) => done(rowName(row), result, body)}
              onStale={() => setStaleNotice(true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
