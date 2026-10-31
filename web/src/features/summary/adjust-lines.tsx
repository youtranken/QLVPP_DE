import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { groupTone } from '@/lib/group-tone';
import { useMe } from '@/lib/me';
import { ItemThumb } from '@/ui/item-thumb';
import { useAdminItems, useAllCategories, type AdminItem } from '@/features/catalog/catalog.api';
import type { LineView } from '@/features/request/request.api';
import { useRequestFormat } from '@/features/request/request-format';
import { ReviewActions } from '@/features/review/review-actions';
import '@/features/review/review.css';
import { AddLinePicker } from './add-line-picker';
import { LineRow } from './adjust-line-row';
import { canRemove, floorOf, type Adjust } from './use-adjust';
import type { AdminRequestView } from './summary.api';

// Server cho giảm dòng đã có bất kể max/ngừng; chỉ tăng khi món còn bán và dưới max; món chỉ Hành chính không có trần UI
function maxOf(l: LineView, item: AdminItem | undefined): number {
  if (!item?.active) return l.qty;
  return item.admin_only ? Infinity : Math.max(l.qty, item.max_qty);
}

function useLineFacts() {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const items = useAdminItems();
  const cats = useAllCategories();
  const byId = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  const toneOf = (item: AdminItem | undefined) => groupTone(cats.data ?? [], item?.category_id ?? null);
  const metaOf = (unit: string | null, item: AdminItem | undefined) => {
    const u = fmt.unit(unit);
    if (item?.admin_only) return t('summary.adjust.metaAdminOnly', { unit: u });
    return item ? t('summary.adjust.meta', { unit: u, max: item.max_qty }) : u;
  };
  return { items: items.data ?? [], byId, toneOf, metaOf, fmt };
}

function LineTags({ line, adminOnly }: { line: LineView; adminOnly: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      {line.added_by_admin && <span className="tag">{t('summary.adjust.addedByAdmin')}</span>}
      {adminOnly && <span className="tag tag--dark">{t('summary.adjust.adminOnly')}</span>}
      {line.delivered_qty > 0 && <span className="tag tag--ok">{t('summary.adjust.delivered', { n: line.delivered_qty })}</span>}
      {line.cancelled_qty > 0 && <span className="tag">{t('summary.adjust.cancelled', { n: line.cancelled_qty })}</span>}
    </>
  );
}

function qtyProps(a: Adjust, l: LineView) {
  return {
    qty: a.qtyOf(l),
    base: l.qty,
    min: floorOf(l),
    error: a.errors.lines?.[l.id] || undefined,
    removed: a.removed.includes(l.id),
    onQty: (n: number) => a.edit.setQty(l.id, n),
    onRemove: canRemove(l) ? () => a.edit.remove(l.id) : undefined,
    onRestore: () => a.edit.restore(l.id),
  };
}

// Dòng ngoài danh mục: review áp dụng ngay (tách khỏi Lưu), số lượng vẫn sửa cùng Lưu
function CustomLine({ a, line, ym }: { a: Adjust; line: LineView; ym: string }) {
  const { t } = useTranslation();
  const me = useMe();
  const fmt = useRequestFormat();
  const name = line.item ? fmt.name(line.item) : (line.custom_name ?? '');
  const unit = fmt.unit(line.item?.unit ?? line.custom_unit);
  return (
    <LineRow
      {...qtyProps(a, line)}
      name={name}
      meta={line.review_status === 'converted' ? unit : t('summary.adjust.customMeta', { qty: line.qty, unit })}
      thumb={<ItemThumb fileId={line.image_file_id} alt={t('summary.adjust.imageAlt', { name })} tone="g0" size={48} />}
      max={Math.max(line.qty, me.config.default_max_qty)}
      // Dòng bị từ chối không mua/giao nên sửa số lượng vô nghĩa
      readOnly={line.review_status === 'rejected'}
    >
      {line.custom_note && <p className="aj-line__note">{t('summary.adjust.customNote', { note: line.custom_note })}</p>}
      <ReviewActions key={line.id} line={{ ...line, custom_name: name }} onDone={a.reviewed} onStale={() => a.reviewStale(line.id)} />
      {line.review_status === 'pending' && (
        <Link className="aj-line__link" to={`/admin/review?status=pending&ym=${ym}`}>
          {t('summary.adjust.toReview')}
        </Link>
      )}
    </LineRow>
  );
}

export function AdjustLines({ a, view }: { a: Adjust; view: AdminRequestView }) {
  const { t } = useTranslation();
  const f = useLineFacts();
  // Dòng từng là món ngoài DM (kể cả đã duyệt) vẫn ở danh sách riêng để thấy kết quả review
  const catalog = view.lines.filter((l) => l.review_status === 'n/a');
  const custom = view.lines.filter((l) => l.review_status !== 'n/a');
  const kept = view.lines.filter((l) => !a.removed.includes(l.id));
  const units = kept.reduce((s, l) => s + a.qtyOf(l), 0) + a.added.reduce((s, x) => s + x.qty, 0);
  // Mọi dòng còn giữ có món (kể cả converted) chặn trùng như api (DUPLICATE_ITEM)
  const taken = new Set([...kept.filter((l) => l.item_id).map((l) => l.item_id), ...a.added.map((x) => x.item_id)]);
  const candidates = f.items.filter((i) => i.active && !taken.has(i.id));

  return (
    <section className="aj-section">
      <div className="aj-section__head">
        <h3>{t('summary.adjust.heading', { n: kept.length + a.added.length })}</h3>
        <span className="num">{t('summary.adjust.units', { n: units })}</span>
      </div>
      <ul className="aj-lines" aria-label={t('summary.adjust.lines')}>
        {catalog.map((l) => {
          const item = l.item_id ? f.byId.get(l.item_id) : undefined;
          const name = l.item ? f.fmt.name(l.item) : '';
          return (
            <LineRow
              key={l.id}
              {...qtyProps(a, l)}
              name={name}
              meta={f.metaOf(l.item?.unit ?? null, item)}
              thumb={<ItemThumb fileId={l.item?.image_file_id ?? null} alt="" tone={f.toneOf(item)} size={48} />}
              max={maxOf(l, item)}
              tags={<LineTags line={l} adminOnly={item?.admin_only ?? l.item?.admin_only ?? false} />}
            />
          );
        })}
        {a.added.map((x) => {
          const item = f.byId.get(x.item_id);
          return (
            <LineRow
              key={x.key}
              name={item ? f.fmt.name(item) : x.item_id}
              meta={f.metaOf(item?.unit ?? null, item)}
              thumb={<ItemThumb fileId={item?.image_file_id ?? null} alt="" tone={f.toneOf(item)} size={48} />}
              qty={x.qty}
              min={1}
              max={item?.admin_only ? Infinity : (item?.max_qty ?? x.qty)}
              error={a.errors.lines?.[x.key] || undefined}
              tags={
                <>
                  <span className="tag tag--info">{t('summary.adjust.isNew')}</span>
                  {item?.admin_only && <span className="tag tag--dark">{t('summary.adjust.adminOnly')}</span>}
                </>
              }
              onQty={(n) => a.edit.setAddedQty(x.key, n)}
              onRemove={() => a.edit.dropAdded(x.key)}
            />
          );
        })}
      </ul>
      <AddLinePicker items={candidates} onPick={(i) => a.edit.add(i.id)} />
      {custom.length > 0 && (
        <ul className="aj-lines" aria-label={t('summary.adjust.custom')}>
          {custom.map((l) => (
            <CustomLine key={l.id} a={a} line={l} ym={view.period_ym} />
          ))}
        </ul>
      )}
    </section>
  );
}
