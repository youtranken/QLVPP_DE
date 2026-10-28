import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { useAdminItems } from '@/features/catalog/catalog.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { REVIEW_FILTERS, useReviewCache, useReviewLines, type ReviewFilter, type ReviewRow } from './review.api';
import { ReviewCard } from './review-card';
import '@/features/admin/admin.css';
import './review.css';
import { YM } from '@/lib/ym';

// Cùng mẫu với api/src/common/ym.ts
const MONTHS_BACK = 12;

function recentMonths(openYm: string | undefined): string[] {
  if (!openYm) return [];
  const [y, m] = openYm.split('-').map(Number);
  return Array.from({ length: MONTHS_BACK }, (_, i) => {
    const at = y * 12 + (m - 1) - i;
    return `${Math.floor(at / 12)}-${String((at % 12) + 1).padStart(2, '0')}`;
  });
}

const isFilter = (s: string | null): s is ReviewFilter => REVIEW_FILTERS.includes(s as ReviewFilter);

// Dòng đã thêm vào danh mục không còn custom_name: lấy tên món đích
function useRowName() {
  const items = useAdminItems();
  const names = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i.name])), [items.data]);
  return (row: ReviewRow) => row.custom_name ?? (row.item_id ? names.get(row.item_id) : undefined) ?? '';
}

export function ReviewPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const askedStatus = params.get('status');
  const status: ReviewFilter = isFilter(askedStatus) ? askedStatus : 'pending';
  const askedYm = params.get('ym') ?? '';
  const ym = YM.test(askedYm) ? askedYm : '';
  const current = useCurrentPeriod();
  const months = recentMonths(current.data?.ym);
  const list = useReviewLines(status, ym);
  const cache = useReviewCache();
  const rowName = useRowName();
  const [staleNotice, setStaleNotice] = useState(false);

  const update = (next: { status?: ReviewFilter; ym?: string }) => {
    const s = next.status ?? status;
    const y = next.ym ?? ym;
    setStaleNotice(false);
    setParams({ ...(s !== 'pending' ? { status: s } : {}), ...(y ? { ym: y } : {}) });
  };

  return (
    <div className="a-stack">
      <div className="a-toolbar rv-tools">
        <div role="radiogroup" aria-label={t('review.filters.label')} className="seg seg--sm rv-filter">
          {REVIEW_FILTERS.map((f) => (
            <button key={f} type="button" role="radio" aria-checked={status === f} onClick={() => update({ status: f })}>
              {t(`review.filters.${f}`)}
            </button>
          ))}
        </div>
        <label className="rv-period">
          <span>{t('review.period')}</span>
          <select className="a-input" value={ym} onChange={(e) => update({ ym: e.target.value })}>
            <option value="">{t('review.allPeriods')}</option>
            {months.map((m) => (
              <option key={m} value={m}>
                {t('review.month', { month: Number(m.slice(5)), year: m.slice(0, 4) })}
              </option>
            ))}
          </select>
        </label>
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
        <EmptyState title={t(status === 'pending' ? 'review.emptyPending' : 'review.empty')} />
      ) : (
        <div className="rv-list">
          {list.data.items.map((row) => (
            <ReviewCard
              key={row.line_id}
              row={row}
              name={rowName(row)}
              onDone={() => void cache.markListStale()}
              onStale={() => setStaleNotice(true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
