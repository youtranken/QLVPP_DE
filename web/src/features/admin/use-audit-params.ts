import { useMemo } from 'react';
import { useUrlPatch, type UrlPatch } from '@/lib/use-url-patch';
import { NO_FILTERS, type AuditFilters } from './admin.api';

const KEYS = ['actor', 'action', 'from', 'to'] as const;

export function useAuditParams() {
  const [params, update] = useUrlPatch();
  const actor = params.get('actor') ?? '';
  const action = params.get('action') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const filters = useMemo<AuditFilters>(() => ({ actor, action, from, to }), [actor, action, from, to]);
  const patch = (next: Partial<AuditFilters>) => {
    const p: UrlPatch = {};
    for (const k of KEYS) if (k in next) p[k] = next[k] || null;
    update(p);
  };
  return { filters, patch, apply: (f: AuditFilters) => patch(f), clear: () => patch(NO_FILTERS) };
}
