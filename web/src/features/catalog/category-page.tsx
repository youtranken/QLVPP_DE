import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { patchCategory, useAllCategories, useRefreshCatalog, type Category } from '@/features/catalog/catalog.api';
import { catalogErrorKey } from '@/features/catalog/catalog-errors';
import { reorderPatches } from '@/features/catalog/category-order';
import { CategoryForm } from '@/features/catalog/category-form';
import '@/features/catalog/catalog.css';

export function CategoryPage() {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const confirm = useConfirm();
  const refresh = useRefreshCatalog();
  const categories = useAllCategories();
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const list = categories.data ?? [];

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await work();
    } catch (e) {
      setActionError(t(catalogErrorKey(e)));
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const move = (index: number, dir: -1 | 1) =>
    run(() =>
      Promise.all(reorderPatches(list, index, dir).map((p) => patchCategory(p.id, { sort_order: p.sort_order }, csrfToken))),
    );

  const toggleActive = async (c: Category) => {
    const verb = c.active ? 'deactivate' : 'reactivate';
    const ok = await confirm({
      title: t(`catalog.categories.${verb}Title`, { name: c.name }),
      message: t(`catalog.categories.${verb}Body`),
      confirmLabel: t(`catalog.categories.${verb}`),
      danger: c.active,
    });
    if (ok) await run(() => patchCategory(c.id, { active: !c.active }, csrfToken));
  };

  if (categories.isError) return <LoadError onRetry={() => void categories.refetch()} />;

  return (
    <div className="a-stack">
      <div className="a-toolbar">
        <Link className="btn" to="/admin/catalog">
          ← {t('catalog.categories.back')}
        </Link>
        <span className="sp" />
        <button type="button" className="btn btn--primary" onClick={() => setEditing(null)}>
          {t('catalog.categories.add')}
        </button>
      </div>
      {actionError && (
        <p role="alert" className="alert alert--danger">
          {actionError}
        </p>
      )}
      <section className="a-panel">
        {categories.isPending ? (
          <Loading />
        ) : list.length === 0 ? (
          <EmptyState title={t('catalog.categories.empty')} />
        ) : (
          <div className="table-wrap">
            <table className="table table-stack">
              <thead>
                <tr>
                  <th>{t('catalog.categories.colOrder')}</th>
                  <th>{t('catalog.categories.colName')}</th>
                  <th>{t('catalog.categories.colNameEn')}</th>
                  <th>{t('catalog.categories.colStatus')}</th>
                  <th className="col-actions">{t('catalog.categories.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c, i) => (
                  <tr key={c.id} className={c.active ? undefined : 'is-inactive'}>
                    <td className="col-order">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t('catalog.categories.moveUp', { name: c.name })}
                        disabled={busy || i === 0}
                        onClick={() => void move(i, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={t('catalog.categories.moveDown', { name: c.name })}
                        disabled={busy || i === list.length - 1}
                        onClick={() => void move(i, 1)}
                      >
                        ↓
                      </button>
                    </td>
                    <td data-label={t('catalog.categories.colName')}>
                      <b>{c.name}</b>
                    </td>
                    <td data-label={t('catalog.categories.colNameEn')}>{c.name_en ?? t('common.empty')}</td>
                    <td data-label={t('catalog.categories.colStatus')}>
                      <span className={c.active ? 'tag tag--ok' : 'tag'}>
                        {t(c.active ? 'catalog.status.active' : 'catalog.status.inactive')}
                      </span>
                    </td>
                    <td className="col-actions">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn--sm"
                          aria-label={t('catalog.categories.editLabel', { name: c.name })}
                          onClick={() => setEditing(c)}
                        >
                          {t('catalog.categories.edit')}
                        </button>
                        <button type="button" className="btn btn--sm" disabled={busy} onClick={() => void toggleActive(c)}>
                          {t(c.active ? 'catalog.categories.deactivate' : 'catalog.categories.reactivate')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing !== undefined && (
        <CategoryForm
          category={editing}
          nextSortOrder={list.reduce((m, c) => Math.max(m, c.sort_order + 1), 0)}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
