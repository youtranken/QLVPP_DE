import { vi } from 'vitest';
import { jsonResponse } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { Unit } from '@/features/units/units.api';
import { PRINT_UNITS, SNAPSHOT_ID, snapshotRow } from './reports-fixtures';
import type { SnapshotData, SnapshotRow } from './reports.api';

interface Options {
  id?: string;
  query?: string;
  snapshots?: SnapshotRow[];
  units?: Unit[];
}

export function openPrint(reply: Response | SnapshotData, opts: Options = {}) {
  const id = opts.id ?? SNAPSHOT_ID;
  const fetchMock = vi.fn(async (url: string) => {
    if (url === `/api/admin/reports/snapshots/${id}`) return reply instanceof Response ? reply.clone() : jsonResponse(200, reply);
    if (/^\/api\/admin\/reports\/\d{4}-\d{2}\/snapshots$/.test(url)) return jsonResponse(200, { items: opts.snapshots ?? [snapshotRow({ id, kind: 'print' })] });
    if (url === '/api/units') return jsonResponse(200, opts.units ?? PRINT_UNITS);
    return jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 });
  });
  vi.stubGlobal('fetch', fetchMock);
  mockViewport(1280);
  const view = renderApp(makeMe('admin'), `/admin/reports/snapshots/${id}/print${opts.query ?? ''}`);
  return Object.assign(fetchMock, { unmount: view.unmount });
}
