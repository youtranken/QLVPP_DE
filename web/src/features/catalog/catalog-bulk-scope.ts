import type { CatalogRow, CategoryIndex } from './catalog-rows';

export interface BulkScope {
  pausable: CatalogRow[];
  resumable: CatalogRow[];
  locked: CatalogRow[];
}

// Nút hàng loạt theo nội dung lựa chọn (không theo tab): món của nhóm tạm ngưng không đổi từng món được
export function bulkScope(rows: CatalogRow[], selected: ReadonlySet<string>, index: CategoryIndex): BulkScope {
  const scope: BulkScope = { pausable: [], resumable: [], locked: [] };
  for (const r of rows) {
    if (!selected.has(r.id)) continue;
    if (index.byId.get(r.group)?.active === false) scope.locked.push(r);
    else if (r.active) scope.pausable.push(r);
    else scope.resumable.push(r);
  }
  return scope;
}
