import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorCode } from '@/lib/api-error';
import { useMe } from '@/lib/me';
import { useLeaveGuard } from '@/features/request/use-leave-guard';
import { discardOptions, useConfirm } from '@/ui/confirm-context';
import { EmptyState, LoadError, Loading } from '@/ui/load-state';
import { ListMeta } from '@/ui/list-meta';
import { ReorderBar, ReorderToggle } from '@/ui/reorder';
import { useToast } from '@/ui/toast-context';
import { Toolbar } from '@/ui/toolbar';
import { useReorderMode } from '@/ui/use-reorder-mode';
import { SetupHeader } from '@/features/catalog/setup-page';
import { matchesSearch } from '@/features/request/request-format';
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
  const sort = useReorderMode(order);
  const leavePrompt = useMemo(() => discardOptions(t), [t]);
  useLeaveGuard(sort.on ? order.moved : 0, leavePrompt);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<AdminUnit | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [q, setQ] = useState('');

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
    <button type="button" className={sort.on ? 'btn' : 'btn btn--primary'} onClick={() => setAdding(true)}>
      {t('units.page.add')}
    </button>
  );
  const list = order.ordered;
  // Đang sắp xếp thì cần thấy đủ đơn vị: bỏ lọc
  const query = sort.on ? '' : q.trim();
  const visible = (u: AdminUnit) => !query || matchesSearch([u.name, u.name_en].filter(Boolean).join(' '), query);
  const shown = list.filter(visible).length;
  // Cùng khung thanh công cụ với tab Nhóm (ô tìm · đếm · Sắp xếp): đổi tab không làm nút đổi chỗ
  const tools = !sort.on && list.length > 0 && (
    <div className="setup-tools">
      <Toolbar search={{ value: q, onChange: setQ, label: t('units.page.search'), placeholder: t('units.page.search'), maxLength: 40 }} />
      <ListMeta>
        <p className="setup-shown" role="status">
          {t('units.page.shown', { shown, total: list.length })}
        </p>
      </ListMeta>
      <ReorderToggle count={list.length} onStart={sort.start} />
    </div>
  );
  return (
    <div className="ct-page">
      <SetupHeader variant="units" description={t('units.page.description')} primary={add} tabsEnd={tools || undefined} />
      {actionError && (
        <p role="alert" className="alert alert--danger">
          {actionError}
        </p>
      )}
      {units.isError ? (
        <LoadError onRetry={() => void units.refetch()} />
      ) : units.isPending ? (
        <Loading />
      ) : list.length === 0 ? (
        <EmptyState title={t('units.page.empty')} hint={t('units.page.emptyHint')} action={add} />
      ) : (
        <div className="ct-block un-block">
          {sort.on && (
            <Toolbar>
              <ReorderBar dirty={order.dirty} dirtyText={t('units.page.dirty', { n: order.moved })} saving={order.saving} onCancel={() => void sort.cancel()} onSave={() => void sort.save()} />
            </Toolbar>
          )}
          {shown === 0 ? (
            <EmptyState art="no-match" title={t('units.page.noMatch')} />
          ) : (
            <UnitTable
              visible={query ? visible : undefined}
              ordered={list}
              busy={busy || order.saving}
              sorting={sort.on}
              onMove={order.move}
              onMoveTo={order.moveTo}
              onEdit={setEditing}
              onToggleActive={(u) => void toggleActive(u)}
              onDelete={(u) => void remove(u)}
            />
          )}
        </div>
      )}
      {adding && <UnitDialog onClose={() => setAdding(false)} />}
      {editing && <UnitDialog unit={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
