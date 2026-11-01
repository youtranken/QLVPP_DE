import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { useToast } from '@/ui/toast-context';
import { patchCategory, useAdminItems, useAllCategories, useRefreshCatalog, type Category } from './catalog.api';
import { CategoryDialog } from './category-dialog';
import { CategoryPreview } from './category-preview';
import { CategoryTable } from './category-table';
import { catalogErrorKey } from './catalog-errors';
import { useCategoryOrder } from './use-category-order';
import './catalog.m1.css';
import './categories.m1.css';

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

function useItemCounts() {
  const items = useAdminItems();
  return useMemo(() => {
    const all = new Map<string, number>();
    const active = new Map<string, number>();
    for (const i of items.data ?? []) {
      if (!i.category_id) continue;
      bump(all, i.category_id);
      if (i.active) bump(active, i.category_id);
    }
    return { all, active };
  }, [items.data]);
}

export function CategoriesPage() {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const confirm = useConfirm();
  const toast = useToast();
  const refresh = useRefreshCatalog();
  const categories = useAllCategories();
  const counts = useItemCounts();
  const order = useCategoryOrder(categories.data ?? []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggleActive = async (c: Category) => {
    const verb = c.active ? 'deactivate' : 'reactivate';
    const ok = await confirm({
      title: t(`catalog.categories.${verb}Title`, { name: c.name }),
      message: t(`catalog.categories.${verb}Body`, { n: counts.active.get(c.id) ?? 0 }),
      confirmLabel: t(`catalog.categories.${verb}`),
      danger: c.active,
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      const saved = await patchCategory(c.id, { active: !c.active }, csrfToken);
      toast.show({ text: t('catalog.categories.saved', { name: saved?.name ?? c.name }), tone: 'ok' });
      await refresh();
    } catch (e) {
      setActionError(t(catalogErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  const add = (
    <button type="button" className={order.dirty ? 'btn' : 'btn btn--primary'} onClick={() => setAdding(true)}>
      {t('catalog.categories.add')}
    </button>
  );
  const title = t('catalog.categoriesTitle');
  const header = (
    <PageHeader
      crumbs={[t('nav.groups.stock'), t('catalog.title'), title]}
      title={title}
      description={t('catalog.categories.description')}
      actions={
        <>
          <Link className="btn" to="/admin/catalog">
            {t('catalog.categories.back')}
          </Link>
          {add}
        </>
      }
    />
  );

  const list = order.ordered;
  return (
    <div className="ct-page">
      {header}
      {order.dirty && (
        <div className="cg-dirty">
          <span className="cg-dirty__text">{t('catalog.categories.dirty', { n: order.moved })}</span>
          <button type="button" className="btn btn--ghost" disabled={order.saving} onClick={order.revert}>
            {t('catalog.categories.revert')}
          </button>
          <button type="button" className="btn btn--primary" disabled={order.saving} aria-busy={order.saving} onClick={() => void order.save()}>
            {order.saving ? t('catalog.form.saving') : t('catalog.categories.saveOrder')}
          </button>
        </div>
      )}
      {actionError && (
        <p role="alert" className="alert alert--danger">
          {actionError}
        </p>
      )}
      {categories.isError ? (
        <LoadError onRetry={() => void categories.refetch()} />
      ) : categories.isPending ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState title={t('catalog.categories.empty')} hint={t('catalog.categories.emptyHint')} action={add} />
      ) : (
        <div className="cg-layout">
          <CategoryTable ordered={list} counts={counts.all} busy={busy || order.saving} onMove={order.move} onEdit={setEditing} onToggleActive={(c) => void toggleActive(c)} />
          <CategoryPreview ordered={list} />
        </div>
      )}
      {adding && <CategoryDialog categories={list} onClose={() => setAdding(false)} />}
      {editing && <CategoryDialog categories={list} category={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
