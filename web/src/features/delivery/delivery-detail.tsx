import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { groupTone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { Loading, LoadError } from '@/ui/load-state';
import { useAdminItems, useAllCategories } from '@/features/catalog/catalog.api';
import type { AdminRequestView } from '@/features/summary/summary.api';
import { isDeliverable, remainingOf } from './delivery.api';
import { DeliveryLineRow } from './delivery-line-row';
import type { LineModel } from './delivery-lines';
import { DeliveryAvatar } from './delivery-avatar';
import { DeliveryResult } from './delivery-result';
import { useDeliveryRequest } from './use-delivery-request';

function DetailHead({ view }: { view: AdminRequestView }) {
  const { t } = useTranslation();
  const name = view.full_name ?? view.user_sub;
  const effective = view.lines.filter(isDeliverable);
  const done = effective.filter((l) => remainingOf(l) <= 0).length;
  return (
    <header className="dv-detail__head">
      <DeliveryAvatar name={name} large />
      <div className="dv-detail__who">
        <h2>{name}</h2>
        <p>{t('delivery.detail.saved', { department: view.department ?? t('delivery.noDepartment'), time: formatVnStamp(view.updated_at) })}</p>
      </div>
      <span className="tag tag--brand num">{t('delivery.detail.lineCount', { done, total: effective.length })}</span>
    </header>
  );
}

function SelectAllBox({ checked, mixed, disabled, onChange }: { checked: boolean; mixed: boolean; disabled: boolean; onChange: () => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return <input ref={ref} type="checkbox" aria-label={t('delivery.detail.selectAll')} checked={checked} disabled={disabled} onChange={onChange} />;
}

function useThumbOf() {
  const items = useAdminItems();
  const cats = useAllCategories();
  const categoryOf = new Map((items.data ?? []).map((i) => [i.id, i.category_id]));
  return (m: LineModel) => (
    <ItemThumb
      fileId={m.line.item?.image_file_id ?? m.line.image_file_id}
      alt=""
      tone={groupTone(cats.data ?? [], m.line.item_id ? (categoryOf.get(m.line.item_id) ?? null) : null)}
      size={36}
    />
  );
}

function DetailFoot({ d, canAll, phone }: { d: ReturnType<typeof useDeliveryRequest>; canAll: boolean; phone: boolean }) {
  const { t } = useTranslation();
  return (
    <footer className="dv-foot">
      {d.outcome && phone && <DeliveryResult outcome={d.outcome} />}
      <button type="button" className="btn" disabled={d.selectedCount === 0 || d.pending} onClick={() => void d.actions.deliverPicked()}>
        {t('delivery.detail.deliverSelected', { n: d.selectedCount })}
      </button>
      <button type="button" className="btn btn--primary" disabled={!canAll || d.pending} onClick={() => void d.actions.deliverEverything()}>
        {d.busy === 'all' ? t('delivery.detail.sending') : t('delivery.detail.deliverAll')}
      </button>
    </footer>
  );
}

export function DeliveryDetail({ requestId, onCompleted }: { requestId: string; onCompleted: (id: string) => void }) {
  const { t } = useTranslation();
  const d = useDeliveryRequest(requestId, onCompleted);
  const thumbOf = useThumbOf();
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  if (d.query.isError) return <LoadError onRetry={() => void d.query.refetch()} />;
  if (!d.view) return <Loading />;
  const view = d.view;
  const short = d.lines.filter((m) => m.short).length;
  const canAll = d.lines.some((m) => m.deliverable);
  const reviewHref = `/admin/review?status=pending&ym=${view.period_ym}`;

  return (
    <section className="dv-detail" aria-label={view.full_name ?? view.user_sub}>
      <DetailHead view={view} />
      {d.block && (
        <p role="alert" className="alert alert--danger">
          {d.block}
        </p>
      )}
      {short > 0 && <p className="alert alert--warn">{t('delivery.detail.shortWarn', { n: short })}</p>}
      {d.outcome && !phone && <DeliveryResult outcome={d.outcome} />}
      <div className="table-wrap dv-lines-wrap">
        <table className="table dv-lines" aria-label={t('delivery.detail.lines', { name: view.full_name ?? view.user_sub })}>
          <thead>
            <tr>
              <th className="sel">
                <SelectAllBox
                  checked={d.selectableCount > 0 && d.selectedCount === d.selectableCount}
                  mixed={d.selectedCount > 0 && d.selectedCount < d.selectableCount}
                  disabled={d.selectableCount === 0}
                  onChange={d.actions.toggleAll}
                />
              </th>
              <th>{t('delivery.detail.colItem')}</th>
              <th className="r">{t('delivery.detail.colQty')}</th>
              <th className="r">{t('delivery.detail.colDelivered')}</th>
              <th className="r">{t('delivery.detail.colStock')}</th>
              <th className="r">{t('delivery.detail.colGive')}</th>
              <th>
                <span className="sr-only">{t('delivery.detail.colAction')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {d.lines.map((m) => (
              <DeliveryLineRow
                key={m.id}
                m={m}
                thumb={thumbOf(m)}
                selected={d.selected.has(m.id)}
                sending={d.busy === m.id}
                disabled={d.pending}
                reviewHref={reviewHref}
                onQty={(n) => d.actions.setQty(m, n)}
                onToggle={() => d.actions.toggle(m.id)}
                onDeliver={() => void d.actions.deliverOne(m)}
              />
            ))}
          </tbody>
        </table>
      </div>
      <DetailFoot d={d} canAll={canAll} phone={phone} />
    </section>
  );
}
