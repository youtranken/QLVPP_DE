import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toneAtRank } from '@/lib/group-tone';
import { usePanelParam } from '@/lib/use-panel-param';
import { useLeaveGuard } from '@/features/request/use-leave-guard';
import { discardOptions } from '@/ui/confirm-context';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { ReorderBar, ReorderToggle } from '@/ui/reorder';
import { Toolbar } from '@/ui/toolbar';
import { matchesSearch } from '@/features/request/request-format';
import { useReorderMode } from '@/ui/use-reorder-mode';
import { useAdminItems, useAllCategories, useRefreshCatalog, type AdminItem, type Category } from './catalog.api';
import { CategoryDialog } from './category-dialog';
import { CategoryTable } from './category-table';
import { GroupPanel } from './group-panel';
import { SetupHeader } from './setup-page';
import { useCategoryOrder } from './use-category-order';
import { useGroupToggle } from './use-group-toggle';
import './catalog.m1.css';
import './categories.m1.css';

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

function useItemCounts(items: ReturnType<typeof useAdminItems>) {
  return useMemo(() => {
    const all = new Map<string, number>();
    for (const i of items.data ?? []) if (i.category_id) bump(all, i.category_id);
    return { all, ready: items.isSuccess };
  }, [items.data, items.isSuccess]);
}

const NO_ITEMS: AdminItem[] = [];

export function CategoriesPage() {
  const { t } = useTranslation();
  const refresh = useRefreshCatalog();
  const categories = useAllCategories();
  const items = useAdminItems();
  const counts = useItemCounts(items);
  const order = useCategoryOrder(categories.data ?? []);
  const sort = useReorderMode(order);
  const leavePrompt = useMemo(() => discardOptions(t), [t]);
  useLeaveGuard(sort.on ? order.moved : 0, leavePrompt);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [q, setQ] = useState('');
  const group = useGroupToggle(items.data, refresh);
  const list = order.ordered;
  const ids = useMemo(() => list.map((c) => c.id), [list]);
  const panel = usePanelParam('group', { order: ids, known: (id) => (categories.isSuccess ? ids.includes(id) : undefined) });
  const openIndex = panel.id ? list.findIndex((c) => c.id === panel.id) : -1;
  // Đang sắp xếp thì cần thấy đủ nhóm: bỏ lọc
  const query = sort.on ? '' : q.trim();
  const visible = (c: Category) => !query || matchesSearch([c.name, c.name_en].filter(Boolean).join(' '), query);
  const shown = query ? list.filter(visible).length : list.length;
  const tools = !sort.on && list.length > 0 && (
    <div className="cg-search">
      <Toolbar search={{ value: q, onChange: setQ, label: t('catalog.categories.search'), placeholder: t('catalog.categories.search'), maxLength: 100 }} />
      <ReorderToggle count={list.length} onStart={sort.start} />
    </div>
  );

  const add = (
    <button type="button" className={sort.on ? 'btn' : 'btn btn--primary'} onClick={() => setAdding(true)}>
      {t('catalog.categories.add')}
    </button>
  );
  return (
    <div className="ct-page">
      <SetupHeader
        variant="groups"
        description={t('catalog.categories.description')}
        primary={add}
        tabsEnd={tools || undefined}
      />
      {group.error && !panel.id && (
        <p role="alert" className="alert alert--danger">
          {group.error}
        </p>
      )}
      {categories.isError ? (
        <LoadError onRetry={() => void categories.refetch()} />
      ) : categories.isPending ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState title={t('catalog.categories.noGroups')} hint={t('catalog.categories.emptyHint')} action={add} />
      ) : (
        <div className="ct-block">
          {sort.on && (
            <Toolbar>
              <ReorderBar dirty={order.dirty} dirtyText={t('catalog.categories.dirty', { n: order.moved })} saving={order.saving} onCancel={() => void sort.cancel()} onSave={() => void sort.save()} />
            </Toolbar>
          )}
          {!sort.on && (
            <p className="cg-shown" role="status">
              {t('catalog.categories.shown', { shown, total: list.length })}
            </p>
          )}
          {shown === 0 ? (
            <EmptyState art="no-match" title={t('catalog.categories.noMatch')} />
          ) : (
            <CategoryTable
              visible={query ? visible : undefined}
              ordered={list}
              counts={counts.all}
              countsReady={counts.ready}
              busy={group.busy || order.saving}
              sorting={sort.on}
              onMove={order.move}
              onMoveTo={order.moveTo}
              onEdit={setEditing}
              onToggleActive={(c) => void group.toggle(c)}
              onOpen={(c) => panel.open(c.id)}
            />
          )}
        </div>
      )}
      {openIndex >= 0 && (
        <GroupPanel
          group={list[openIndex]}
          tone={toneAtRank(openIndex)}
          items={items.data ?? NO_ITEMS}
          loading={items.isPending}
          loadError={items.isError}
          onRetry={() => void items.refetch()}
          busy={group.busy}
          error={group.error}
          onToggleGroup={(c, notify) => void group.toggle(c, notify)}
          onClose={panel.close}
          refresh={refresh}
        />
      )}
      {adding && <CategoryDialog categories={list} onClose={() => setAdding(false)} />}
      {editing && <CategoryDialog categories={list} category={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
