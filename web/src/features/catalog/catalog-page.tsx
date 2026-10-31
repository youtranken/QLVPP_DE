import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { FilterNotice } from '@/ui/filter-notice';
import { LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { categoryLabel, useAdminItems, useAllCategories, useRefreshCatalog } from './catalog.api';
import { applyView, byActive, catalogStats, groupCounts, indexCategories, toRows } from './catalog-rows';
import { CatalogStats } from './catalog-stats';
import { CatalogTable } from './catalog-table';
import { CatalogToolbar } from './catalog-toolbar';
import { CategoryChips } from './category-chips';
import { BulkMaxDialog, BulkMoveDialog } from './bulk-dialogs';
import { ItemDrawer } from './item-drawer';
import { useBulkItems } from './use-bulk-items';
import { useCatalogActions } from './use-catalog-actions';
import { useCatalogParams } from './use-catalog-params';
import '@/features/admin/admin.css';
import './catalog.m1.css';

type BulkDialog = 'max' | 'move' | null;

function useCatalogData(view: ReturnType<typeof useCatalogParams>['view']) {
  const items = useAdminItems();
  const categories = useAllCategories();
  const index = useMemo(() => indexCategories(categories.data ?? []), [categories.data]);
  const all = useMemo(() => toRows(items.data ?? [], index), [items.data, index]);
  const base = useMemo(() => byActive(all, view.inactive), [all, view.inactive]);
  const rows = useMemo(() => applyView(all, view), [all, view]);
  const stats = useMemo(() => catalogStats(items.data ?? [], categories.data ?? []), [items.data, categories.data]);
  const counts = useMemo(() => groupCounts(base), [base]);
  return { items, categories, index, all, base, rows, stats, counts };
}

export function CatalogPage() {
  const { t, i18n } = useTranslation();
  const p = useCatalogParams();
  const d = useCatalogData(p.view);
  const refresh = useRefreshCatalog();
  const bulk = useBulkItems(refresh);
  const actions = useCatalogActions(refresh, bulk.setRowError);
  const [search, setSearch] = useUrlSearchBox(p.view.q, p.setQ);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [dialog, setDialog] = useState<BulkDialog>(null);
  const { keepOnly } = bulk;
  useEffect(() => keepOnly(new Set(d.rows.map((r) => r.id))), [d.rows, keepOnly]);
  const title = t('catalog.title');
  const orderedIds = d.rows.map((r) => r.id);
  const groupKeys = [...d.counts.keys()];
  const allCollapsed = groupKeys.length > 0 && groupKeys.every((k) => collapsed.has(k));
  const editing = p.itemId && p.itemId !== 'new' ? d.items.data?.find((i) => i.id === p.itemId) : undefined;
  const visible = d.rows.filter((r) => !collapsed.has(r.group));
  const at = editing ? visible.findIndex((r) => r.id === editing.id) : -1;
  const stepTo = (k: number) => (at >= 0 && visible[k] ? () => p.openItemDrawer(visible[k].id) : undefined);

  const runBulk = async (body: Parameters<typeof bulk.run>[1], doneText: (n: number) => string) => {
    await bulk.run(orderedIds, body, doneText);
    setDialog(null);
  };
  const deactivateSelected = async () => {
    if (await actions.confirmDeactivateMany(bulk.count)) await bulk.run(orderedIds, { active: false }, (n) => t('catalog.bulk.deactivated', { n }));
  };

  const header = (
    <PageHeader
      crumbs={[t('nav.groups.stock'), title]}
      title={title}
      description={t('catalog.list.description')}
      actions={
        <>
          <Link className="btn" to="/admin/categories">
            {t('catalog.page.categoriesLink')}
          </Link>
          <button type="button" className="btn btn--primary" onClick={() => p.openItemDrawer('new')}>
            {t('catalog.page.add')}
          </button>
        </>
      }
    />
  );

  if (d.items.isError || d.categories.isError) {
    return (
      <div className="ct-page">
        {header}
        <LoadError
          onRetry={() => {
            void d.items.refetch();
            void d.categories.refetch();
          }}
        />
      </div>
    );
  }

  const loaded = d.items.isSuccess && d.categories.isSuccess;
  return (
    <div className="ct-page">
      {header}
      {loaded && <CatalogStats stats={d.stats} filter={p.view.filter} narrowed={p.view.filter !== null || p.view.cat !== null || p.view.q !== ''} onFilter={p.toggleFilter} onClear={p.clearAll} />}
      <CatalogToolbar
        search={search}
        onSearch={setSearch}
        searchable={d.base.length}
        inactiveCount={d.stats.inactive}
        showInactive={p.view.inactive}
        onToggleInactive={p.toggleInactive}
        allCollapsed={allCollapsed}
        onToggleCollapse={() => setCollapsed(allCollapsed ? new Set() : new Set(groupKeys))}
        bulk={{ count: bulk.count, pending: bulk.pending, onMax: () => setDialog('max'), onMove: () => setDialog('move'), onDeactivate: () => void deactivateSelected(), onClear: bulk.clear }}
      />
      {loaded && <CategoryChips index={d.index} counts={d.counts} total={d.base.length} value={p.view.cat} onChange={p.setCat} />}
      {p.view.filter && <FilterNotice label={t(`catalog.stats.${p.view.filter === 'noimage' ? 'noImage' : p.view.filter}`)} count={d.rows.length} onClear={p.clearFilter} />}
      <CatalogTable
        rows={d.rows}
        index={d.index}
        loading={!loaded}
        selection={bulk.selection}
        rowErrors={bulk.rowErrors}
        activeRowId={editing?.id}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        onOpen={(id) => p.openItemDrawer(id)}
        onAddToGroup={(cat) => p.openItemDrawer('new', cat)}
        onSaveMax={actions.saveMax}
        onToggleActive={(row) => void actions.toggleActive(row)}
        empty={{
          hint: t('catalog.list.emptyHint'),
          action: (
            <span className="ct-empty-actions">
              <button type="button" className="btn" onClick={p.clearAll}>
                {t('common.filter.clear')}
              </button>
              <button type="button" className="btn" onClick={() => p.openItemDrawer('new')}>
                {t('catalog.page.add')}
              </button>
            </span>
          ),
        }}
      />
      {dialog === 'max' && (
        <BulkMaxDialog count={bulk.count} onClose={() => setDialog(null)} onSubmit={(n) => runBulk({ max_qty: n }, (k) => t('catalog.bulk.maxDone', { n: k }))} />
      )}
      {dialog === 'move' && (
        <BulkMoveDialog
          count={bulk.count}
          categories={d.index.ordered}
          onClose={() => setDialog(null)}
          onSubmit={(cat) => runBulk({ category_id: cat.id }, (k) => t('catalog.bulk.moveDone', { n: k, name: categoryLabel(cat, i18n.language) }))}
        />
      )}
      {loaded && (p.itemId === 'new' || editing) && (
        <ItemDrawer
          item={editing ?? null}
          categories={d.categories.data ?? []}
          rows={d.all}
          defaultCategoryId={p.itemCategoryId}
          onClose={p.closeItemDrawer}
          onPrev={stepTo(at - 1)}
          onNext={stepTo(at + 1)}
        />
      )}
    </div>
  );
}
