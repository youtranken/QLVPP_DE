import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useSingleFlight } from '@/lib/use-single-flight';
import { useToast } from '@/ui/toast-context';
import { useAdminItems } from '@/features/catalog/catalog.api';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { useRefreshStock } from '@/features/stock/stock.api';
import { adminRequestKey, useAdminRequest, type AdminRequestView } from '@/features/summary/summary.api';
import { isComplete, useRefreshAfterDelivery } from './delivery.api';
import { buildLines, isSelectable, type LineError, type LineModel } from './delivery-lines';
import type { DeliveryOutcome } from './delivery-outcome';
import { deliverEverything, deliverOne, deliverPicked, type DeliveryCtx } from './delivery-request-actions';
import { useDeliverSelected } from './use-deliver-selected';

function useLineState(requestId: string) {
  const fmt = useRequestFormat();
  const query = useAdminRequest(requestId);
  const items = useAdminItems();
  const [qtys, setQtys] = useState<Record<string, { key: string; value: number }>>({});
  const [errors, setErrors] = useState<Record<string, LineError>>({});
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const stockById = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i.stock_qty])), [items.data]);
  const view = query.data;
  const lines = view
    ? buildLines({
        lines: view.lines,
        stockById,
        errors,
        qtys,
        version: query.dataUpdatedAt,
        nameOf: (l) => (l.item ? fmt.name(l.item) : (l.custom_name ?? '')),
        unitOf: (l) => fmt.unit(l.item?.unit ?? l.custom_unit),
      })
    : [];
  return { query, view, lines, setErrors, setQtys, selected, setSelected };
}

type LineState = ReturnType<typeof useLineState>;

function useDeliveryCtx(requestId: string, s: LineState, onCompleted: (id: string) => void) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = useRefreshAfterDelivery();
  const refreshStock = useRefreshStock();
  const sendSelected = useDeliverSelected();
  const flight = useSingleFlight();
  const [busy, setBusy] = useState<string | null>(null);
  const [block, setBlock] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DeliveryOutcome | null>(null);
  const person = s.view?.full_name ?? '';
  // Phiếu vừa đủ (theo bản tải lại, hoặc request_complete của server) → toast + báo trang cho phiếu rời bộ lọc
  const completeIf = (wasComplete: boolean, force = false) => {
    const fresh = qc.getQueryData<AdminRequestView>(adminRequestKey(requestId));
    if (wasComplete || !(force || (fresh && isComplete(fresh.lines)))) return false;
    toast.show({ text: t('delivery.detail.toastComplete', { name: person }), tone: 'ok' });
    onCompleted(requestId);
    return true;
  };
  const run = (what: string, task: (wasComplete: boolean) => Promise<void>) =>
    flight.run(async () => {
      setBusy(what);
      setBlock(null);
      setOutcome(null);
      try {
        await task(s.view ? isComplete(s.view.lines) : true);
      } finally {
        setBusy(null);
      }
    });
  const ctx: DeliveryCtx = {
    t, requestId, csrfToken, run, completeIf, refreshStock, sendSelected, setBlock, setOutcome,
    month: s.view ? monthOf(s.view.period_ym) : 0,
    lines: s.lines,
    selected: s.selected,
    reload: () => refresh(requestId).catch(() => undefined),
    versionNow: () => qc.getQueryState(adminRequestKey(requestId))?.dataUpdatedAt ?? 0,
    toastLine: (m) => toast.show({ text: t('delivery.detail.toastLine', { qty: m.qty, unit: m.unit, name: m.name }), tone: 'ok' }),
    setErrors: s.setErrors,
    setSelected: s.setSelected,
  };
  return { ctx, busy, block, outcome, pending: flight.pending };
}

export function useDeliveryRequest(requestId: string, onCompleted: (id: string) => void) {
  const s = useLineState(requestId);
  const { ctx, busy, block, outcome, pending } = useDeliveryCtx(requestId, s, onCompleted);
  const selectable = s.lines.filter(isSelectable);
  const selectedCount = selectable.filter((m) => s.selected.has(m.id)).length;
  const actions = {
    deliverOne: (m: LineModel) => deliverOne(ctx, m),
    deliverPicked: () => deliverPicked(ctx),
    deliverEverything: () => deliverEverything(ctx),
    setQty: (m: LineModel, value: number) => s.setQtys((q) => ({ ...q, [m.id]: { key: m.qtyKey, value } })),
    toggle: (id: string) => s.setSelected((sel) => (sel.has(id) ? new Set([...sel].filter((x) => x !== id)) : new Set([...sel, id]))),
    toggleAll: () => s.setSelected(selectedCount === selectable.length ? new Set() : new Set(selectable.map((m) => m.id))),
  };
  return {
    query: s.query,
    view: s.view,
    lines: s.lines,
    busy,
    pending,
    block,
    outcome,
    selected: s.selected,
    selectedCount,
    selectableCount: selectable.length,
    actions,
  };
}
