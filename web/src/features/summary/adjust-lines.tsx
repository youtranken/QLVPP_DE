import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ItemThumb } from '@/ui/item-thumb';
import { useAdminItems, useAllCategories, type AdminItem } from '@/features/catalog/catalog.api';
import { indexCategories } from '@/features/catalog/catalog-rows';
import type { LineView } from '@/features/request/request.api';
import { useRequestFormat } from '@/features/request/request-format';
import { ReviewActions } from '@/features/review/review-actions';
import { LineReduce } from './adjust-line-reason';
import { LineRow } from './adjust-line-row';
import { canRemove, floorOf, isOverMax, type Adjust } from './use-adjust';
import type { AdminRequestView } from './summary.api';

function useLineFacts() {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const items = useAdminItems();
  const cats = useAllCategories();
  const byId = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  const tones = useMemo(() => indexCategories(cats.data ?? []).tone, [cats.data]);
  const toneOf = (item: AdminItem | undefined) => (item?.category_id ? (tones.get(item.category_id) ?? 'g0') : 'g0');
  const metaOf = (unit: string | null, item: AdminItem | undefined) => {
    const u = fmt.unit(unit);
    return item ? t('summary.adjust.meta', { unit: u, max: item.max_qty }) : u;
  };
  return { byId, toneOf, metaOf, fmt };
}

// Món tạm ngưng (món hoặc nhóm ngừng)
const isPaused = (line: LineView, item: AdminItem | undefined) => line.item?.active === false || item?.usable === false;
// Dòng món tạm ngưng chưa giao gì không được tính vào kỳ (server cùng luật) → chỉ đọc, không bỏ được; đã giao một phần thì sửa như thường
const notCounted = (line: LineView, item: AdminItem | undefined) => isPaused(line, item) && line.delivered_qty === 0;

function LineTags({ line }: { line: LineView }) {
  const { t } = useTranslation();
  return (
    <>
      {line.added_by_admin && <span className="tag">{t('summary.adjust.addedByAdmin')}</span>}
      {isOverMax(line) && <span className="tag tag--warn">{t('warn.W12a', { max: line.max_qty })}</span>}
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

// Dòng ngoài danh mục: "Thêm vào danh mục"/"Không mua" áp dụng ngay; còn chờ duyệt thì Lưu mặc định mua lần này
function CustomLine({ a, line }: { a: Adjust; line: LineView }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const name = line.item ? fmt.name(line.item) : (line.custom_name ?? '');
  const unit = fmt.unit(line.item?.unit ?? line.custom_unit);
  // Dòng sẽ bỏ: chỉ còn "Sẽ bỏ khỏi phiếu" + "Giữ lại"
  const removed = a.removed.includes(line.id);
  return (
    <LineRow
      {...qtyProps(a, line)}
      name={name}
      meta={line.review_status === 'converted' ? unit : t('summary.adjust.customMeta', { qty: line.qty, unit })}
      thumb={<ItemThumb fileId={line.image_file_id} alt={t('summary.adjust.imageAlt', { name })} tone="g0" size={48} />}
      // Dòng bị từ chối không mua/giao nên sửa số lượng vô nghĩa
      readOnly={line.review_status === 'rejected'}
    >
      {line.custom_note && <p className="aj-line__note">{t('summary.adjust.customNote', { note: line.custom_note })}</p>}
      {!removed && (
        <ReviewActions key={line.id} variant="adjust" line={{ ...line, custom_name: name }} onDone={a.reviewed} onStale={() => a.reviewStale(line.id)} />
      )}
      {a.isReduced(line) && !removed && <LineReduce a={a} line={line} unit={unit} />}
    </LineRow>
  );
}

export function AdjustLines({ a, view }: { a: Adjust; view: AdminRequestView }) {
  const { t } = useTranslation();
  const f = useLineFacts();
  // Dòng từng là món ngoài DM (kể cả đã duyệt) vẫn ở danh sách riêng để thấy kết quả review
  const catalog = view.lines.filter((l) => l.review_status === 'n/a');
  const custom = view.lines.filter((l) => l.review_status !== 'n/a');
  const itemOf = (l: LineView) => (l.item_id ? f.byId.get(l.item_id) : undefined);
  // Khớp Số món/Tổng ở bảng kỳ: bỏ dòng sẽ xóa, dòng không mua, dòng món tạm ngưng không được tính
  const kept = view.lines.filter((l) => !a.removed.includes(l.id) && l.review_status !== 'rejected' && !notCounted(l, itemOf(l)));
  const units = kept.reduce((s, l) => s + a.qtyOf(l), 0);

  return (
    <section className="aj-section">
      <div className="aj-section__head">
        <h3>{t('summary.adjust.heading', { n: kept.length })}</h3>
        <span className="num">{t('summary.adjust.units', { n: units })}</span>
      </div>
      {/* Khối lý do mở không chuyển focus: chỉ báo bằng vùng aria-live */}
      <p className="sr-only" aria-live="polite">
        {a.missing > 0 ? t('summary.adjust.lineReasonRequired') : ''}
      </p>
      <ul className="aj-lines" aria-label={t('summary.adjust.lines')}>
        {catalog.map((l) => {
          const item = itemOf(l);
          const name = l.item ? f.fmt.name(l.item) : '';
          const muted = notCounted(l, item);
          const removed = a.removed.includes(l.id);
          return (
            <LineRow
              key={l.id}
              {...qtyProps(a, l)}
              {...(muted ? { readOnly: true, onRemove: undefined } : {})}
              paused={isPaused(l, item)}
              muted={muted}
              name={name}
              meta={f.metaOf(l.item?.unit ?? null, item)}
              thumb={<ItemThumb fileId={l.item?.image_file_id ?? null} alt="" tone={f.toneOf(item)} size={48} />}
              tags={<LineTags line={l} />}
            >
              {a.isReduced(l) && !removed && <LineReduce a={a} line={l} unit={f.fmt.unit(l.item?.unit ?? null)} />}
            </LineRow>
          );
        })}
      </ul>
      {custom.length > 0 && (
        <ul className="aj-lines" aria-label={t('summary.adjust.custom')}>
          {custom.map((l) => (
            <CustomLine key={l.id} a={a} line={l} />
          ))}
        </ul>
      )}
    </section>
  );
}
