export interface DeliveryOutcome {
  kind: 'selected' | 'all';
  delivered: number;
  failed: { name: string; reason: string }[];
}

export function outcomeText(o: DeliveryOutcome, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (o.delivered === 0 && o.failed.length === 0) return t('delivery.result.none');
  if (o.failed.length === 0) return t('delivery.result.delivered', { n: o.delivered });
  const item = o.kind === 'all' ? 'delivery.result.itemAll' : 'delivery.result.itemSelected';
  const list = o.failed.map((f) => t(item, { name: f.name, reason: f.reason })).join(o.kind === 'all' ? ', ' : '; ');
  return t(o.kind === 'all' ? 'delivery.result.failedAll' : 'delivery.result.failedSelected', { n: o.delivered, k: o.failed.length, list });
}
