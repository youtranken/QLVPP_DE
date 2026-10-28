import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { categoryLabel, fileUrl, type AdminItem, type Category } from '@/features/catalog/catalog.api';

export function useCatalogColumns({
  categories,
  onEdit,
  onToggleActive,
}: {
  categories: Category[];
  onEdit: (item: AdminItem) => void;
  onToggleActive: (item: AdminItem) => void;
}): ColumnDef<AdminItem, unknown>[] {
  const { t, i18n } = useTranslation();
  return useMemo(() => {
    const categoryName = (id: string | null) => {
      const c = categories.find((x) => x.id === id);
      if (!c) return t('catalog.page.noCategory');
      return categoryLabel(c, i18n.language);
    };
    return [
      {
        id: 'image',
        header: t('catalog.page.colImage'),
        meta: { className: 'col-thumb' },
        cell: ({ row }) =>
          row.original.image_file_id ? (
            <img className="thumb" src={fileUrl(row.original.image_file_id)} alt={row.original.name} loading="lazy" />
          ) : (
            <span className="tag tag--warn">{t('catalog.page.missingImage')}</span>
          ),
      },
      {
        accessorKey: 'name',
        header: t('catalog.page.colName'),
        cell: ({ row }) => (
          <div className="item-name">
            <b>{row.original.name}</b>
            {row.original.pack_note && <small>{row.original.pack_note}</small>}
          </div>
        ),
      },
      {
        id: 'unit',
        accessorFn: (r) => t(`catalog.units.${r.unit}`),
        header: t('catalog.page.colUnit'),
      },
      {
        id: 'category',
        accessorFn: (r) => categoryName(r.category_id),
        header: t('catalog.page.colCategory'),
      },
      {
        accessorKey: 'max_qty',
        header: t('catalog.page.colMax'),
        enableGlobalFilter: false,
        meta: { className: 'num r' },
      },
      {
        accessorKey: 'stock_qty',
        header: t('catalog.page.colStock'),
        enableGlobalFilter: false,
        meta: { className: 'num r' },
      },
      {
        accessorKey: 'admin_only',
        header: t('catalog.page.colAdminOnly'),
        enableGlobalFilter: false,
        cell: ({ row }) =>
          row.original.admin_only ? <span className="tag tag--info">{t('catalog.page.adminOnly')}</span> : null,
      },
      {
        accessorKey: 'active',
        header: t('catalog.page.colStatus'),
        enableGlobalFilter: false,
        cell: ({ row }) =>
          row.original.active ? (
            <span className="tag tag--ok">{t('catalog.status.active')}</span>
          ) : (
            <span className="tag">{t('catalog.status.inactive')}</span>
          ),
      },
      {
        id: 'actions',
        header: t('catalog.page.colActions'),
        meta: { className: 'col-actions' },
        cell: ({ row }) => (
          <div className="row-actions">
            <button
              type="button"
              className="btn btn--sm"
              aria-label={t('catalog.page.editLabel', { name: row.original.name })}
              onClick={() => onEdit(row.original)}
            >
              {t('catalog.page.edit')}
            </button>
            <button type="button" className="btn btn--sm" onClick={() => onToggleActive(row.original)}>
              {t(row.original.active ? 'catalog.page.deactivate' : 'catalog.page.reactivate')}
            </button>
          </div>
        ),
      },
    ];
  }, [categories, onEdit, onToggleActive, t, i18n.language]);
}
