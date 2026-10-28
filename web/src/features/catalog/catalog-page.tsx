import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { DataTable } from '@/ui/data-table';
import { LoadError } from '@/ui/load-state';
import {
  categoryLabel,
  patchItem,
  useAdminItems,
  useAllCategories,
  useRefreshCatalog,
  type AdminItem,
} from '@/features/catalog/catalog.api';
import { catalogErrorKey } from '@/features/catalog/catalog-errors';
import { useCatalogColumns } from '@/features/catalog/catalog-columns';
import { ItemForm } from '@/features/catalog/item-form';
import '@/features/catalog/catalog.css';

// undefined = form đóng, null = thêm món mới
type Editing = AdminItem | null | undefined;

export function CatalogPage() {
  const { t, i18n } = useTranslation();
  const { csrfToken } = useMe();
  const confirm = useConfirm();
  const refresh = useRefreshCatalog();
  const items = useAdminItems();
  const categories = useAllCategories();
  const [categoryId, setCategoryId] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Editing>(undefined);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggleActive = useCallback(
    async (item: AdminItem) => {
      const verb = item.active ? 'deactivate' : 'reactivate';
      const ok = await confirm({
        title: t(`catalog.page.${verb}Title`, { name: item.name }),
        message: t(`catalog.page.${verb}Body`),
        confirmLabel: t(`catalog.page.${verb}`),
        danger: item.active,
      });
      if (!ok) return;
      setActionError(null);
      try {
        await patchItem(item.id, { active: !item.active }, csrfToken);
        void refresh();
      } catch (e) {
        setActionError(t(catalogErrorKey(e)));
      }
    },
    [confirm, csrfToken, refresh, t],
  );

  const columns = useCatalogColumns({
    categories: categories.data ?? [],
    onEdit: setEditing,
    onToggleActive: toggleActive,
  });

  if (items.isError || categories.isError) {
    return (
      <LoadError
        onRetry={() => {
          void items.refetch();
          void categories.refetch();
        }}
      />
    );
  }

  const rows = (items.data ?? []).filter(
    (i) => (showInactive || i.active) && (!categoryId || i.category_id === categoryId),
  );

  return (
    <div className="a-stack">
      <div className="a-toolbar">
        <select
          className="a-input"
          aria-label={t('catalog.page.categoryFilter')}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">{t('catalog.page.allCategories')}</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {categoryLabel(c, i18n.language)}
            </option>
          ))}
        </select>
        <label className="a-check-inline">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {t('catalog.page.showInactive')}
        </label>
        <span className="sp" />
        <Link className="btn" to="/admin/categories">
          {t('catalog.page.categoriesLink')}
        </Link>
        <button type="button" className="btn btn--primary" onClick={() => setEditing(null)}>
          {t('catalog.page.add')}
        </button>
      </div>
      {actionError && (
        <p role="alert" className="alert alert--danger">
          {actionError}
        </p>
      )}
      <section className="a-panel">
        <DataTable
          data={rows}
          columns={columns}
          loading={items.isPending || categories.isPending}
          emptyText={t('catalog.page.empty')}
          searchPlaceholder={t('catalog.page.search')}
          rowClassName={(r) => (r.active ? '' : 'is-inactive')}
          stackOnMobile
        />
      </section>
      {editing !== undefined && (
        <ItemForm item={editing} categories={categories.data ?? []} onClose={() => setEditing(undefined)} />
      )}
    </div>
  );
}
