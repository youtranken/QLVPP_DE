import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/features/catalog/catalog.api';
import { useMe } from '@/lib/me';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { Loading, LoadError } from '@/ui/load-state';
import { CartPanel } from './cart-panel';
import { ItemGrid } from './item-grid';
import { MobileSaveBar } from './mobile-save-bar';
import { PeriodHero } from './period-hero';
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
import { useSaveFlow } from './use-save-flow';
import '@/features/request/request.css';

function useLeaveWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}

function RequestEditor({
  period,
  server,
  items,
  categories,
  refetch,
  onAddCustom,
}: {
  period: CurrentPeriod;
  server: RequestView | null;
  items: MemberItem[];
  categories: Category[];
  refetch: () => Promise<RequestView | null | undefined>;
  onAddCustom?: () => void;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const fmt = useRequestFormat();
  const narrow = useMediaQuery(NARROW_QUERY);
  const ctx = useMemo(
    () => ({ ym: period.ym, items: new Map(items.map((i) => [i.id, i])), defaultMax: me.config.default_max_qty }),
    [period.ym, items, me.config.default_max_qty],
  );
  const cart = useCart(server, ctx);
  const flow = useSaveFlow(cart, period.ym, refetch);
  useLeaveWarning(cart.dirtyCount > 0);

  const orderable = useMemo(() => items.filter((i) => i.active && !i.admin_only), [items]);
  const lineByKey = useMemo(() => new Map(cart.lines.map((l) => [l.key, l])), [cart.lines]);
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

  return (
    <div className="rq-page">
      <div className="rq-main">
        <PeriodHero period={period} saved={cart.saved} dirty={dirty} />
        <ItemGrid
          items={orderable}
          categories={categories}
          lineByKey={lineByKey}
          onQty={setQty}
          onAddCustom={onAddCustom}
        />
      </div>
      <CartPanel
        lines={cart.lines}
        errors={flow.lineErrors}
        categories={categories}
        showSave={!narrow}
        saveLabel={saveLabel}
        canSave={dirty && !flow.saving}
        formError={flow.formError}
        onQty={setQty}
        onRemove={remove}
        onSave={flow.openConfirm}
        onAddCustom={onAddCustom}
      />
      {narrow && (
        <MobileSaveBar count={cart.lines.length} label={saveLabel} canSave={dirty && !flow.saving} onSave={flow.openConfirm} />
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
      {flow.stale && <StaleDialog reloading={flow.reloading} onReload={() => void flow.reload()} onClose={flow.closeStale} />}
      <div className="rq-toast-slot" role="status" aria-live="polite">
        {flow.toast && <span className="rq-toast">{flow.toast}</span>}
      </div>
    </div>
  );
}

export function RequestPage({ onAddCustom }: { onAddCustom?: () => void }) {
  const period = useCurrentPeriod();
  const request = useMyRequest(period.data?.ym);
  const lineItemIds =
    request.data === undefined ? undefined : (request.data?.lines.flatMap((l) => (l.item_id ? [l.item_id] : [])) ?? []);
  const items = useMemberItems(lineItemIds);
  const categories = useMemberCategories();

  const failed = [period, request, items, categories].find((q) => q.isError);
  if (failed) return <LoadError onRetry={() => void failed.refetch()} />;
  if (!period.data || request.data === undefined || !items.data || !categories.data) return <Loading />;
  return (
    <RequestEditor
      period={period.data}
      server={request.data}
      items={items.data}
      categories={categories.data}
      refetch={async () => {
        const r = await request.refetch();
        if (r.isError) throw r.error;
        return r.data;
      }}
      onAddCustom={onAddCustom}
    />
  );
}
