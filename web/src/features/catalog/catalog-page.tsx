import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePanelParam } from '@/lib/use-panel-param';
import { LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { categoryLabel, useAdminItems, useAllCategories, useRefreshCatalog, type AdminItem, type Category } from './catalog.api';
import { applyView, groupCounts, indexCategories, toRows, type CatalogView, type CategoryIndex } from './catalog-rows';
import { CatalogFilterBar } from './catalog-filter-bar';
import { CatalogGrid } from './catalog-grid';
import { inTab, tabCounts, type CatalogTab } from './catalog-tabs';
import { CatalogTable } from './catalog-table';
import { BulkMaxDialog, BulkMoveDialog } from './bulk-dialogs';
import { ItemDrawer } from './item-drawer';
import { useBulkItems } from './use-bulk-items';
import { bulkScope } from './catalog-bulk-scope';
import { useGroupToggle } from './use-group-toggle';
import { useCatalogActions } from './use-catalog-actions';
import { useCatalogParams } from './use-catalog-params';
import './catalog.m1.css';

type BulkDialog = 'max' | 'move' | null;
const NO_COLLAPSE: ReadonlySet<string> = new Set();

const pausedGroups = (index: CategoryIndex): ReadonlySet<string> => new Set(index.ordered.filter((c) => !c.active).map((c) => c.id));

function useCatalogData(view: CatalogView, tab: CatalogTab) {
  const items = useAdminItems();
  const categories = useAllCategories();
  const index = useMemo(() => indexCategories(categories.data ?? []), [categories.data]);
  const all = useMemo(() => toRows(items.data ?? [], index), [items.data, index]);
  const base = useMemo(() => all.filter((r) => inTab(r, tab)), [all, tab]);
  const rows = useMemo(() => applyView(base, view), [base, view]);
  const tabs = useMemo(() => tabCounts(all), [all]);
  const counts = useMemo(() => groupCounts(base), [base]);
  return { items, categories, index, base, rows, counts, tabs };
}

const knownItem = (items: AdminItem[] | undefined) => (id: string) => (id === 'new' ? true : items ? items.some((i) => i.id === id) : undefined);

export function CatalogPage() {
  const { t, i18n } = useTranslation();
  const p = useCatalogParams();
  const d = useCatalogData(p.view, p.tab);
  const refresh = useRefreshCatalog();
  const bulk = useBulkItems(refresh);
  const actions = useCatalogActions(refresh, bulk.setRowError);
  const [dialog, setDialog] = useState<BulkDialog>(null);
  const groups = useGroupToggle(d.items.data, refresh);
  const [stored, setCollapsed] = useState<ReadonlySet<string> | null>(null);
  const stoppedKeys = useMemo(() => pausedGroups(d.index), [d.index]);
  // Chưa chọn gì: nhóm tạm ngưng thu gọn sẵn. Đang tìm thì mở mọi nhóm để kết quả không nằm trong nhóm đang thu; xóa ô tìm thì trả lại như cũ
  const collapsed = p.view.q.trim() ? NO_COLLAPSE : (stored ?? stoppedKeys);
  const title = t('catalog.title');
  const grid = p.mode === 'grid';
  const groupKeys = useMemo(() => [...new Set(d.rows.map((r) => r.group))], [d.rows]);
  const allCollapsed = groupKeys.length > 0 && groupKeys.every((k) => collapsed.has(k));
  const visible = useMemo(() => (grid ? d.rows : d.rows.filter((r) => !collapsed.has(r.group))).map((r) => r.id), [grid, d.rows, collapsed]);
  const { keepOnly } = bulk;
  // Hàng bị lọc hoặc nằm trong nhóm đang thu thì bỏ chọn: mọi thao tác hàng loạt chỉ chạm hàng đang thấy
  useEffect(() => keepOnly(new Set(visible)), [visible, keepOnly]);
  const panel = usePanelParam('item', { order: visible, known: knownItem(d.items.data), extra: ['itemCat'] });
  const editing = panel.id && panel.id !== 'new' ? d.items.data?.find((i) => i.id === panel.id) : undefined;
  const openItem = (id: string) => panel.open(id);
  const addItem = (categoryId?: string) => panel.open('new', { itemCat: categoryId ?? null });

  const reactivateGroup = (c: Category) => {
    setCollapsed((prev) => new Set([...(prev ?? stoppedKeys)].filter((k) => k !== c.id)));
    void groups.toggle(c);
  };
  const runBulk = async (body: Parameters<typeof bulk.run>[1], doneText: (n: number) => string) => {
    await bulk.run(visible, body, doneText);
    setDialog(null);
  };
  const scope = useMemo(() => bulkScope(d.rows, bulk.selection.selected, d.index), [d.rows, bulk.selection.selected, d.index]);
  const reactivateSelected = async () => {
    const eligible = scope.resumable.map((r) => r.id);
    if (eligible.length > 0) await bulk.run(eligible, { active: true }, (n) => t('catalog.bulk.reactivated', { n }));
    // Món của nhóm tạm ngưng: không đổi được từng món, bật lại nhóm trước
    for (const r of scope.locked) bulk.setRowError(r.id, t('catalog.categories.enableGroupFirst'));
  };
  const deactivateSelected = async () => {
    // Chỉ món đang dùng được: món đã ngừng riêng hoặc ngừng theo nhóm không PATCH (tránh biến "ngừng theo nhóm" thành "ngừng riêng")
    const picked = scope.pausable;
    if (picked.length === 0) return;
    if (await actions.confirmDeactivateMany(picked.map((r) => ({ id: r.id, name: r.name })))) {
      await bulk.run(picked.map((r) => r.id), { active: false }, (n) => t('catalog.bulk.deactivated', { n }));
    }
  };

  const emptyActions = (
    <span className="ct-empty-actions">
      <button type="button" className="btn" onClick={p.clearAll}>
        {t('common.filter.clear')}
      </button>
      <button type="button" className="btn" onClick={() => addItem()}>
        {t('catalog.page.add')}
      </button>
    </span>
  );

  const header = (
    <PageHeader
      crumbs={[t('nav.groups.stock'), title]}
      title={title}
      description={t('catalog.list.description')}
      secondary={
        <Link className="btn" to="/admin/categories">
          {t('catalog.page.categoriesLink')}
        </Link>
      }
      primary={
        <button type="button" className="btn btn--primary" onClick={() => addItem()}>
          {t('catalog.page.add')}
        </button>
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
      <div className="ct-block">
        <CatalogFilterBar
          q={p.view.q}
          onSearch={p.setQ}
          searchable={d.base.length}
          mode={p.mode}
          onMode={p.setMode}
          tab={p.tab}
          tabCounts={loaded ? d.tabs : null}
          onTab={p.setTab}
          index={d.index}
          counts={d.counts}
          total={d.base.length}
          group={p.view.group}
          onGroup={p.setGroup}
          collapse={grid || p.view.q.trim() ? null : { all: allCollapsed, onToggle: () => setCollapsed(allCollapsed ? NO_COLLAPSE : new Set(groupKeys)) }}
          bulk={grid ? null : { count: bulk.count, pending: bulk.pending, scope: { pause: scope.pausable.length, resume: scope.resumable.length, locked: scope.locked.length }, onReactivate: () => void reactivateSelected(), onMax: () => setDialog('max'), onMove: () => setDialog('move'), onPause: () => void deactivateSelected(), onClear: bulk.clear }}
        />
        {grid ? (
          <CatalogGrid rows={d.rows} index={d.index} loading={!loaded} openId={panel.id} onEdit={openItem} emptyAction={emptyActions} tab={p.tab} narrowed={p.narrowed} groupBusy={groups.busy} onReactivateGroup={reactivateGroup} />
        ) : (
          <CatalogTable
            rows={d.rows}
            index={d.index}
            loading={!loaded}
            selection={bulk.selection}
            rowErrors={bulk.rowErrors}
            activeRowId={editing?.id}
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            onOpen={openItem}
            onAddToGroup={addItem}
            onSaveMax={actions.saveMax}
            groupBusy={groups.busy}
            onReactivateGroup={reactivateGroup}
            empty={{ hint: t('catalog.list.emptyHint'), action: emptyActions }}
          />
        )}
      </div>
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
      {loaded && (panel.id === 'new' || editing) && (
        <ItemDrawer
          item={editing ?? null}
          categories={d.categories.data ?? []}
          defaultCategoryId={p.itemCategoryId}
          onClose={panel.close}
          nav={editing ? { index: panel.index, total: panel.total, onStep: panel.step } : undefined}
        />
      )}
    </div>
  );
}
