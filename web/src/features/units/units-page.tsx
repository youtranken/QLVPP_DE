import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { useToast } from '@/ui/toast-context';
import { UnitDialog } from './unit-dialog';
import { unitErrorKey } from './unit-errors';
import { UnitTable } from './unit-table';
import { useUnitOrder } from './use-unit-order';
import { deleteUnit, patchUnit, useAdminUnits, useRefreshUnits, type AdminUnit } from './units.api';
import './units.m1.css';

export function UnitsPage() {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const confirm = useConfirm();
  const toast = useToast();
  const refresh = useRefreshUnits();
  const units = useAdminUnits();
  const order = useUnitOrder(units.data ?? []);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminUnit | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      const code = apiErrorCode(e);
      if (code === 'UNIT_IN_USE') toast.show({ text: t(unitErrorKey(e)), tone: 'danger' });
      else setActionError(t(unitErrorKey(e)));
      if (code === 'UNIT_IN_USE' || code === 'UNIT_NOT_FOUND') await refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (u: AdminUnit) => {
    const verb = u.active ? 'deactivate' : 'reactivate';
    const ok = await confirm({
      title: t(`units.page.${verb}Title`, { name: u.name }),
      message: t(`units.page.${verb}Body`),
      confirmLabel: t(`units.page.${verb}`),
      danger: u.active,
    });
    if (!ok) return;
    await run(async () => {
      const saved = await patchUnit(u.code, { active: !u.active }, csrfToken);
      toast.show({ text: t('units.page.saved', { name: saved?.name ?? u.name }), tone: 'ok' });
      await refresh();
    });
  };

  const remove = async (u: AdminUnit) => {
    const ok = await confirm({
      title: t('units.page.deleteTitle', { name: u.name }),
      message: t('units.page.deleteBody'),
      confirmLabel: t('units.page.deleteConfirm'),
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      await deleteUnit(u.code, csrfToken);
      toast.show({ text: t('units.page.deleted', { name: u.name }), tone: 'ok' });
      await refresh();
    });
  };

  const add = (
    <button type="button" className={order.dirty ? 'btn' : 'btn btn--primary'} onClick={() => setAdding(true)}>
      {t('units.page.add')}
    </button>
  );
  const title = t('nav.units');
  const list = order.ordered;
  return (
    <div className="ct-page">
      <PageHeader crumbs={[t('nav.groups.stock'), title]} title={title} description={t('units.page.description')} primary={add} />
      {actionError && (
        <p role="alert" className="alert alert--danger">
          {actionError}
        </p>
      )}
      {order.dirty && (
        <div className="un-dirty">
          <span className="un-dirty__text">{t('units.page.dirty', { n: order.moved })}</span>
          <button type="button" className="btn btn--ghost" disabled={order.saving} onClick={order.revert}>
            {t('units.page.revert')}
          </button>
          <button type="button" className="btn btn--primary" disabled={order.saving} aria-busy={order.saving} onClick={() => void order.save()}>
            {order.saving ? t('units.page.saving') : t('units.page.saveOrder')}
          </button>
        </div>
      )}
      {units.isError ? (
        <LoadError onRetry={() => void units.refetch()} />
      ) : units.isPending ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState title={t('units.page.empty')} hint={t('units.page.emptyHint')} action={add} />
      ) : (
        <UnitTable ordered={list} busy={busy || order.saving} onMove={order.move} onEdit={setEditing} onToggleActive={(u) => void toggleActive(u)} onDelete={(u) => void remove(u)} />
      )}
      {adding && <UnitDialog onClose={() => setAdding(false)} />}
      {editing && <UnitDialog unit={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
