import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/features/catalog/catalog.api';
import { useMe } from '@/lib/me';
import { langOf, lockPhrase } from '@/lib/period-text';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { MemberPage } from '@/shell/member-page';
import { Loading, LoadError } from '@/ui/load-state';
import { CartPanel } from './cart-panel';
import { CartSheet } from './cart-sheet';
import { CopyPreviousButton, CopySummaryDialog } from './copy-previous-dialog';
import { CustomLineDialog } from './custom-line-dialog';
import { FlowNotice } from './flow-notice';
import { ItemGrid } from './item-grid';
import { NewPeriodDialog } from './new-period-dialog';
import { MobileSaveBar } from './mobile-save-bar';
import { PeriodHero } from './period-hero';
import { ReceiveStrip } from './receive-strip';
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
import { LoadPanel } from '@/shell/member-page';
import { useCart } from './use-cart';
import { useCopyPrevious } from './use-copy-previous';
import { useLeaveGuard } from './use-leave-guard';
import { lockedNotice, useSaveFlow, type LockedInfo } from './use-save-flow';
import '@/features/request/request.m1.css';

// Chỗ đặt focus khi nút đang giữ focus (thanh lưu nổi) biến mất: tiêu đề trang (h1 tabIndex -1), không phải ô tìm món (bật bàn phím điện thoại)
const focusPageHeading = () => document.getElementById('rq-hero-title')?.focus();

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
  const { t, i18n } = useTranslation();
  const me = useMe();
  const fmt = useRequestFormat();
  const narrow = useMediaQuery(NARROW_QUERY);
  const ctx = useMemo(
    () => ({ ym: period.ym, items: new Map(items.map((i) => [i.id, i])), defaultMax: me.config.default_max_qty }),
    [period.ym, items, me.config.default_max_qty],
  );
  const cart = useCart(server, ctx, carry?.carry ?? undefined);
  const cartRef = useRef<HTMLDivElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const flow = useSaveFlow(cart, period.ym, refetch, cartRef, {
    initialNotice: carry ? lockedNotice(t, carry, cart.initialReport?.unavailable) : null,
    onLocked,
    deadline: period.deadline,
  });
  const copy = useCopyPrevious(period.ym, cart, flow);
  // Giỏ mang sang đã vào state lúc mount: bỏ đi để lần mount sau (vd thử tải lại) không áp lần nữa
  const hadCarry = !!carry;
  useEffect(() => {
    if (hadCarry) onCarryUsed();
  }, [hadCarry, onCarryUsed]);
  const [editing, setEditing] = useState<Editing>(null);
  useLeaveGuard(cart.dirtyCount);
  const openerRef = useRef<HTMLButtonElement>(null);
  // Bản mới nhất cho các effect bên dưới: ghi trong effect (chỉ lần render đã commit), đứng trước các effect đọc nó
  const sheetOpenRef = useRef(sheetOpen);
  const narrowRef = useRef(narrow);
  useEffect(() => {
    sheetOpenRef.current = sheetOpen;
    narrowRef.current = narrow;
  });
  // Lỗi theo dòng: mở sheet để dòng lỗi thấy được — một lần cho mỗi sự kiện lỗi (đổi bề ngang không mở lại)
  const lineFailure = flow.noticeEvent?.focusKey ? flow.noticeEvent : null;
  useEffect(() => {
    if (lineFailure && narrowRef.current) setSheetOpen(true);
  }, [lineFailure]);
  // Chỉ sau khi LƯU thành công: đóng sheet, focus về "Xem phiếu" (nút Lưu của thanh nổi biến mất khi không còn thay đổi)
  const savedSeq = flow.savedSeq;
  useEffect(() => {
    if (savedSeq === 0 || !narrowRef.current) return;
    setSheetOpen(false);
    // Lưu phiếu đã bớt hết dòng: thanh nổi đã gỡ (ref null) → focus tiêu đề trang, không rơi về <body>
    const id = setTimeout(() => (openerRef.current ? openerRef.current.focus() : focusPageHeading()), 0);
    return () => clearTimeout(id);
  }, [savedSeq]);
  useEffect(() => {
    if (!narrow) setSheetOpen(false);
  }, [narrow]);

  const lineByKey = useMemo(() => new Map(cart.lines.map((l) => [l.key, l])), [cart.lines]);
  const editingLine = editing?.key ? lineByKey.get(editing.key) : undefined;
  const dirty = cart.dirtyCount > 0;
  const saveLabel = dirty ? t('request.cart.saveDirty', { count: cart.dirtyCount }) : t('request.cart.save');
  const setQty = (key: string, n: number) => {
    flow.touched(key);
    cart.setQty(key, n);
  };
  const remove = (key: string) => {
    flow.touched(key);
    cart.remove(key);
  };
  const addCustom = () => setEditing({});

  const cartProps = {
    lines: cart.lines,
    errors: flow.lineErrors,
    categories,
    month: monthOf(period.ym),
    prevMonth: copy.fromYm ? monthOf(copy.fromYm) : null,
    dirty,
    saved: cart.saved ? { time: fmt.time(cart.saved.updated_at), lastDay: fmt.lastDay(period.deadline) } : null,
    saveLabel,
    lockAt: lockPhrase(period.deadline, langOf(i18n.language)),
    canSave: dirty && !flow.saving,
    panelRef: cartRef,
    readOnly: !period.is_open,
    onDiscard: cart.discard,
    onQty: setQty,
    onRemove: remove,
    onSave: flow.openConfirm,
    onAddCustom: addCustom,
    onEdit: (key: string) => setEditing({ key }),
  };
  const sheetShown = narrow && sheetOpen;

  return (
    <div className="m-page rq-v2">
      <div className="rq-head">
        <PeriodHero
          period={period}
          saved={cart.saved}
          dirty={dirty}
        />
      </div>
      <ReceiveStrip period={period} />
      <NewPeriodDialog period={period} saved={!!cart.saved} copyFromYm={copy.fromYm} onCopy={() => void copy.run()} />
      <div className="rq-frame">
        <div className="m-panel rq-panel">
          <ItemGrid
            items={items}
            categories={categories}
            lineByKey={lineByKey}
            copy={copy.fromYm && <CopyPreviousButton fromYm={copy.fromYm} busy={copy.busy} onClick={() => void copy.run()} />}
            onQty={setQty}
            onAddCustom={addCustom}
          />
        </div>
        {!narrow && <CartPanel {...cartProps} showSave />}
      </div>
      {/* Giỏ trống và không có gì để lưu: bỏ thanh nổi, trả chỗ cho lưới món (thanh dưới vẫn còn) */}
      {narrow && (cart.lines.length > 0 || dirty) && (
        <MobileSaveBar
          count={cart.lines.length}
          units={cart.lines.reduce((sum, l) => sum + l.qty, 0)}
          savedTime={cart.saved && !dirty ? fmt.time(cart.saved.updated_at) : null}
          dirtyCount={cart.dirtyCount}
          openRef={openerRef}
          canSave={dirty && !flow.saving}
          onOpen={() => setSheetOpen(true)}
          onSave={flow.openConfirm}
        />
      )}
      {sheetShown && (
        <CartSheet
          {...cartProps}
          opener={openerRef}
          // Xóa hết dòng trong sheet (giỏ trống, không còn gì để lưu) thì thanh nổi — chỗ có nút mở — đã gỡ: đóng sheet focus tiêu đề trang
          onCloseFocus={() => {
            if (openerRef.current?.isConnected) return false;
            focusPageHeading();
            return true;
          }}
          onOpenChange={setSheetOpen}
          notice={<FlowNotice flow={flow} />}
        />
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
      {!sheetShown && <FlowNotice flow={flow} />}
      <div className="rq-toast-slot" role="status" aria-live="polite">
        {flow.toast && <span className="rq-toast">{flow.toast}</span>}
      </div>
    </div>
  );
}

export function RequestPage() {
  const { t } = useTranslation();
  const period = useCurrentPeriod();
  const request = useMyRequest(period.data?.ym);
  const [carry, setCarry] = useState<Carry | null>(null);
  const clearCarry = useCallback(() => setCarry(null), []);
  const lineItemIds =
    request.data === undefined ? undefined : (request.data?.lines.flatMap((l) => (l.item_id ? [l.item_id] : [])) ?? []);
  const items = useMemberItems(lineItemIds);
  const categories = useMemberCategories();

  const failed = [period, request, items, categories].find((q) => q.isError);
  // Trạng thái tải/lỗi tự đặt trong khung sáng. Lỗi giữ tiêu đề trang như Lịch sử: biết kỳ thì tiêu đề hero, chưa biết thì "Đăng ký"
  if (failed) {
    const title = period.data ? t('request.hero.title', { month: monthOf(period.data.ym) }) : t('nav.register');
    return (
      <MemberPage title={title}>
        <LoadError onRetry={() => void failed.refetch()} />
      </MemberPage>
    );
  }
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
