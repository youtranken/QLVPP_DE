import { useId, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useFormatTime } from '@/lib/format-time';
import { Drawer, DrawerClose, DrawerTitle } from '@/ui/drawer';
import { Loading, LoadError } from '@/ui/load-state';
import { useAdminItems } from '@/features/catalog/catalog.api';
import type { LineView } from '@/features/request/request.api';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { AddLinePicker } from './add-line-picker';
import { CustomBlock, LineRow } from './adjust-lines';
import { canRemove, floorOf, useAdjust, type Adjust } from './use-adjust';
import type { AdminRequestView } from './summary.api';

function Header({ view }: { view: AdminRequestView | undefined }) {
  const { t } = useTranslation();
  const at = useFormatTime();
  return (
    <div className="drawer-header">
      <div className="aj-head">
        <DrawerTitle className="aj-title">
          {view ? t('summary.adjust.title', { name: view.full_name ?? view.user_sub }) : t('summary.adjust.loading')}
        </DrawerTitle>
        {view && (
          <p className="aj-meta">
            {t('summary.adjust.meta', {
              month: monthOf(view.period_ym),
              year: view.period_ym.slice(0, 4),
              department: view.department ?? t('summary.adjust.noDepartment'),
              at: at(view.updated_at),
            })}{' '}
            <span className={view.is_open ? 'tag tag--brand' : 'tag'}>
              {t(view.is_open ? 'summary.adjust.open' : 'summary.adjust.locked')}
            </span>{' '}
            {view.user_status !== 'active' && <span className="tag tag--danger">{t('summary.adjust.leftCompany')}</span>}
          </p>
        )}
      </div>
      <DrawerClose asChild>
        <button type="button" className="sheet-close" aria-label={t('common.close')}>
          ✕
        </button>
      </DrawerClose>
    </div>
  );
}

function Lines({ a, view }: { a: Adjust; view: AdminRequestView }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const me = useMe();
  const items = useAdminItems();
  const byId = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  // Server cho giảm dòng đã có bất kể max/ngừng; chỉ tăng khi món còn bán và dưới max. Chưa tải danh mục → giữ số hiện có
  const maxOf = (l: { item_id: string | null; qty: number }) => {
    if (!l.item_id) return Math.max(l.qty, me.config.default_max_qty);
    const item = byId.get(l.item_id);
    return item?.active ? Math.max(l.qty, item.max_qty) : l.qty;
  };
  const nameOf = (l: LineView) => (l.item ? fmt.name(l.item) : (l.custom_name ?? ''));
  const qtyProps = (l: LineView) => ({
    name: nameOf(l),
    qty: a.qtyOf(l),
    min: floorOf(l),
    max: maxOf(l),
    delivered: l.delivered_qty,
    cancelled: l.cancelled_qty,
    error: a.errors.lines?.[l.id] || undefined,
    removed: a.removed.includes(l.id),
    // Dòng bị từ chối không mua/giao nên sửa số lượng vô nghĩa
    readOnly: l.review_status === 'rejected',
    onQty: (n: number) => a.edit.setQty(l.id, n),
    onRemove: canRemove(l) ? () => a.edit.remove(l.id) : undefined,
    onRestore: () => a.edit.restore(l.id),
  });
  // Dòng từng là món ngoài DM (kể cả đã duyệt) vẫn nằm ở khối viền đứt để thấy kết quả review
  const catalog = view.lines.filter((l) => l.review_status === 'n/a');
  const custom = view.lines.filter((l) => l.review_status !== 'n/a');
  // Mọi dòng còn giữ có món (kể cả converted) chặn trùng như api (DUPLICATE_ITEM)
  const taken = new Set([
    ...view.lines.filter((l) => l.item_id && !a.removed.includes(l.id)).map((l) => l.item_id),
    ...a.added.map((x) => x.item_id),
  ]);
  const candidates = (items.data ?? []).filter((i) => i.active && !taken.has(i.id));

  return (
    <>
      <ul className="aj-lines" aria-label={t('summary.adjust.lines')}>
        {catalog.map((l) => (
          <LineRow
            key={l.id}
            {...qtyProps(l)}
            line={l}
            base={l.qty}
            unit={fmt.unit(l.item?.unit ?? null)}
            tags={l.added_by_admin && <span className="tag">{t('summary.adjust.addedByAdmin')}</span>}
          />
        ))}
        {a.added.map((x) => {
          const item = byId.get(x.item_id);
          const name = item ? fmt.name(item) : x.item_id;
          return (
            <LineRow
              key={x.key}
              name={name}
              unit={fmt.unit(item?.unit ?? null)}
              qty={x.qty}
              min={1}
              max={item?.max_qty ?? x.qty}
              error={a.errors.lines?.[x.key] || undefined}
              tags={
                <>
                  <span className="tag tag--brand">{t('summary.adjust.isNew')}</span>
                  {item?.admin_only && <span className="tag">{t('summary.adjust.adminOnly')}</span>}
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
        <ul className="aj-lines aj-customs" aria-label={t('summary.adjust.custom')}>
          {custom.map((l) => (
            <CustomBlock key={l.id} {...qtyProps(l)} line={l} base={l.qty} onReviewed={a.reviewed} onStale={() => a.reviewStale(l.id)} />
          ))}
        </ul>
      )}
    </>
  );
}

export function AdjustDrawer({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const a = useAdjust(requestId, onClose);
  const reasonId = useId();
  const view = a.view;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void a.save();
  };

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} dirty={a.dirty} dismissible={!a.saving} width={520}>
      <Header view={view} />
      <form className="aj-form" onSubmit={submit} noValidate>
        <div className="drawer-body">
          {a.notice && (
            <p role="alert" className="alert alert--warn">
              {a.notice}
            </p>
          )}
          {a.errors.form && (
            <p role="alert" className="alert alert--danger">
              {a.errors.form}
            </p>
          )}
          {a.query.isError && <LoadError onRetry={a.reload} />}
          {a.query.isPending && <Loading />}
          {view && <Lines a={a} view={view} />}
          {view && (
            <div className={a.errors.reason ? 'ff ff--error aj-reason' : 'ff aj-reason'}>
              <label className="ff-label" htmlFor={reasonId}>
                {t('summary.adjust.reason')}
              </label>
              <textarea
                id={reasonId}
                className="a-input aj-reason-box"
                value={a.reason}
                maxLength={500}
                required={a.locked}
                aria-describedby={`${reasonId}-note`}
                aria-invalid={a.errors.reason ? true : undefined}
                placeholder={t('summary.adjust.reasonPlaceholder')}
                onChange={(e) => a.setReason(e.target.value)}
              />
              <p id={`${reasonId}-note`} className={a.errors.reason ? 'ff-error' : 'ff-hint'}>
                {a.errors.reason ?? t(a.locked ? 'summary.adjust.reasonLocked' : 'summary.adjust.reasonOpen')}
              </p>
            </div>
          )}
        </div>
        <div className="drawer-footer">
          <DrawerClose asChild>
            <button type="button" className="btn" disabled={a.saving}>
              {t('summary.adjust.cancel')}
            </button>
          </DrawerClose>
          <button type="submit" className="btn btn--primary" disabled={!a.canSave}>
            {a.saving ? t('summary.adjust.saving') : t('summary.adjust.save')}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
