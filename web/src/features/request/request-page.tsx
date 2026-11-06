import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/features/catalog/catalog.api';
import { useMe } from '@/lib/me';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { Loading, LoadError } from '@/ui/load-state';
import { CartPanel } from './cart-panel';
import { CopyPreviousButton, CopySummaryDialog } from './copy-previous-dialog';
import { CustomLineDialog } from './custom-line-dialog';
import { ItemGrid } from './item-grid';
import { MobileSaveBar } from './mobile-save-bar';
import { OwedNotice } from './owed-notice';
import { PeriodHero } from './period-hero';
import { PreviousPeriodCard } from './previous-period-card';
import {
  useCurrentPeriod,
  useMemberCategories,
  useMemberItems,
  useMyRequest,
  type CurrentPeriod,
  type MemberItem,
  type RequestView,
} from './request.api';
import { monthOf, useRequestFormat } from './request-format';
import { SaveDialog, StaleDialog } from './save-dialog';
import { useCart } from './use-cart';
import { useCopyPrevious } from './use-copy-previous';
import { useLeaveGuard } from './use-leave-guard';
import { lockedNotice, useSaveFlow, type LockedInfo } from './use-save-flow';
import '@/features/request/request.css';
import '@/features/request/request.m1.css';

// Kỳ đang sửa vừa khóa (PERIOD_LOCKED): editor của kỳ mới nhận giỏ mang sang (nếu có) và câu báo
type Carry = LockedInfo;

// null = đóng; key vắng = thêm dòng mới
type Editing = { key?: string } | null;

function RequestEditor({
  period,
  server,
  items,
  categories,
  carry,
  refetch,
  onLocked,
  onCarryUsed,
}: {
  period: CurrentPeriod;
  server: RequestView | null;
  items: MemberItem[];
  categories: Category[];
  carry: Carry | null;
  refetch: () => Promise<RequestView | null | undefined>;
  onLocked: (carry: Carry) => void;
  onCarryUsed: () => void;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const fmt = useRequestFormat();
  const narrow = useMediaQuery(NARROW_QUERY);
  const ctx = useMemo(
    () => ({ ym: period.ym, items: new Map(items.map((i) => [i.id, i])), defaultMax: me.config.default_max_qty }),
    [period.ym, items, me.config.default_max_qty],
  );
  const cart = useCart(server, ctx, carry?.carry ?? undefined);
  const cartRef = useRef<HTMLElement>(null);
  const flow = useSaveFlow(cart, period.ym, refetch, cartRef, {
    initialNotice: carry ? lockedNotice(t, carry, cart.initialReport?.unavailable) : null,
    onLocked,
  });
  const copy = useCopyPrevious(period.ym, cart, flow);
  // Giỏ mang sang đã vào state lúc mount: bỏ đi để lần mount sau (vd thử tải lại) không áp lần nữa
  const hadCarry = !!carry;
  useEffect(() => {
    if (hadCarry) onCarryUsed();
  }, [hadCarry, onCarryUsed]);
  const [editing, setEditing] = useState<Editing>(null);
  useLeaveGuard(cart.dirtyCount);

  const orderable = useMemo(() => items.filter((i) => i.usable && !i.admin_only), [items]);
  const lineByKey = useMemo(() => new Map(cart.lines.map((l) => [l.key, l])), [cart.lines]);
  // "Hay dùng trước" = món có trong phiếu kỳ trước (GET, không phải chép lại); không có kỳ trước thì thành thứ tự nhóm
  const previousRequest = useMyRequest(period.previous?.ym);
  const favIds = useMemo(
    () => new Set((previousRequest.data?.lines ?? []).flatMap((l) => (l.item_id ? [l.item_id] : []))),
    [previousRequest.data],
  );
  const editingLine = editing?.key ? lineByKey.get(editing.key) : undefined;
  const dirty = cart.dirtyCount > 0;
  const saveLabel = dirty ? t('request.cart.saveDirty', { n: cart.dirtyCount }) : t('request.cart.save');
  const setQty = (key: string, n: number) => {
    flow.touched(key);
    cart.setQty(key, n);
  };
  const remove = (key: string) => {
    flow.touched(key);
    cart.remove(key);
  };
  const addCustom = () => setEditing({});

  return (
    <div className="m-page rq-v2">
      <div className="rq-head">
        <PeriodHero
          period={period}
          saved={cart.saved}
          dirty={dirty}
        />
        <OwedNotice previous={period.previous} />
      </div>
      <PreviousPeriodCard previous={period.previous} />
      <div className="rq-frame">
        <div className="m-panel rq-panel">
          <ItemGrid
            items={orderable}
            categories={categories}
            lineByKey={lineByKey}
            favIds={favIds}
            copy={copy.fromYm && <CopyPreviousButton fromYm={copy.fromYm} busy={copy.busy} onClick={() => void copy.run()} />}
            locked={!period.is_open}
            onQty={setQty}
            onAddCustom={addCustom}
          />
        </div>
        <CartPanel
          lines={cart.lines}
          errors={flow.lineErrors}
          categories={categories}
          month={monthOf(period.ym)}
          prevMonth={copy.fromYm ? monthOf(copy.fromYm) : null}
          dirty={dirty}
          saved={cart.saved ? { time: fmt.time(cart.saved.updated_at), lastDay: fmt.lastDay(period.deadline) } : null}
          locked={!period.is_open}
          showSave={!narrow}
          saveLabel={saveLabel}
          canSave={dirty && !flow.saving}
          panelRef={cartRef}
          onQty={setQty}
          onRemove={remove}
          onSave={flow.openConfirm}
          onAddCustom={addCustom}
          onEdit={(key) => setEditing({ key })}
        />
      </div>
      {narrow && (
        <MobileSaveBar count={cart.lines.length} label={saveLabel} canSave={dirty && !flow.saving} onSave={flow.openConfirm} />
      )}
      {editing && (
        <CustomLineDialog
          initial={editingLine}
          maxQty={me.config.default_max_qty}
          onClose={() => setEditing(null)}
          onSubmit={(line) => {
            if (editingLine) {
              flow.touched(editingLine.key);
              cart.updateCustom(editingLine.key, line);
            } else {
              flow.clearErrors();
              cart.addCustom(line);
            }
            setEditing(null);
          }}
        />
      )}
      {flow.confirming && (
        <SaveDialog
          month={monthOf(period.ym)}
          lastDay={fmt.lastDay(period.deadline)}
          lines={cart.lines}
          saving={flow.saving}
          onClose={flow.closeConfirm}
          onConfirm={() => void flow.save()}
        />
      )}
      {flow.stale && (
        <StaleDialog month={monthOf(period.ym)} reloading={flow.reloading} onReload={() => void flow.reload()} onClose={flow.closeStale} />
      )}
      {copy.summary && <CopySummaryDialog summary={copy.summary} onClose={copy.closeSummary} />}
      {flow.notice && (
        <div className={`rq-notice rq-notice--${flow.noticeTone}`} role="alert" tabIndex={-1} ref={flow.noticeRef}>
          <span>{flow.notice}</span>
          <button type="button" aria-label={t('common.close')} onClick={flow.closeNotice}>
            ✕
          </button>
        </div>
      )}
      <div className="rq-toast-slot" role="status" aria-live="polite">
        {flow.toast && <span className="rq-toast">{flow.toast}</span>}
      </div>
    </div>
  );
}

function LoadPanel({ children }: { children: ReactNode }) {
  return (
    <div className="m-page">
      <div className="m-panel">{children}</div>
    </div>
  );
}

export function RequestPage() {
  const period = useCurrentPeriod();
  const request = useMyRequest(period.data?.ym);
  const [carry, setCarry] = useState<Carry | null>(null);
  const clearCarry = useCallback(() => setCarry(null), []);
  const lineItemIds =
    request.data === undefined ? undefined : (request.data?.lines.flatMap((l) => (l.item_id ? [l.item_id] : [])) ?? []);
  const items = useMemberItems(lineItemIds);
  const categories = useMemberCategories();

  const failed = [period, request, items, categories].find((q) => q.isError);
  // Trang Đăng ký không có panel sáng của shell (m-main--bare): trạng thái tải/lỗi tự đặt trong khung sáng
  if (failed) return <LoadPanel><LoadError onRetry={() => void failed.refetch()} /></LoadPanel>;
  if (!period.data || request.data === undefined || !items.data || !categories.data) return <LoadPanel><Loading /></LoadPanel>;
  const ym = period.data.ym;
  return (
    <RequestEditor
      key={ym}
      period={period.data}
      server={request.data}
      items={items.data}
      categories={categories.data}
      carry={carry && carry.fromYm !== ym ? carry : null}
      refetch={async () => {
        const r = await request.refetch();
        if (r.isError) throw r.error;
        return r.data;
      }}
      onLocked={(next) => {
        setCarry(next);
        void period.refetch();
      }}
      onCarryUsed={clearCarry}
    />
  );
}
