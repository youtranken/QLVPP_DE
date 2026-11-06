import { useSendStateQuery } from './send-adm.api';

export function useSendState(ym: string) {
  const query = useSendStateQuery(ym);
  const d = query.data;
  return {
    query,
    state: d?.state,
    sent: d?.sent ?? null,
    changedAfter: d?.changed_after ?? false,
    changedAt: d?.changed_at ?? null,
    noOrder: d?.no_order_at ? { at: d.no_order_at, by: d.no_order_by_name } : null,
  };
}

export type SendState = ReturnType<typeof useSendState>;
