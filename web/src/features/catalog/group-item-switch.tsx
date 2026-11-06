import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { Switch } from '@/ui/switch';
import type { ToastSpec } from '@/ui/toast-context';
import { patchItem, type AdminItem } from './catalog.api';
import { rowErrorText } from './catalog-errors';
import { usePendingArrivalNote } from './pending-arrival-note';

interface Props {
  item: AdminItem;
  name: string;
  groupActive: boolean;
  hintId?: string;
  refresh: () => Promise<unknown>;
  notify: (toast: ToastSpec) => void;
}

// Ghi ngay, cập nhật lạc quan; một request mỗi món (bấm lần hai khi đang gửi bị bỏ qua).
// Tắt món còn hàng ADM đang về thì hỏi trước (kèm khối cam); không còn gì đang về thì tắt luôn.
export function GroupItemSwitch({ item, name, groupActive, hintId, refresh, notify }: Props) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const confirm = useConfirm();
  const pendingNote = usePendingArrivalNote();
  const busy = useRef(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const askStop = async () => {
    const { warning, unknown } = await pendingNote([{ id: item.id, name }], false);
    if (!warning && !unknown) return true;
    return confirm({ title: t('catalog.list.deactivateTitle', { name }), message: t('catalog.list.deactivateBody'), confirmLabel: t('catalog.bulk.deactivate'), danger: true, warning });
  };

  const send = async (active: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setOptimistic(active);
    setError(null);
    try {
      if (!active && !(await askStop())) return;
      await patchItem(item.id, { active }, csrfToken);
      await refresh();
      if (!active) {
        notify({ text: t('catalog.categories.itemOff', { name }), tone: 'ok', action: { label: t('catalog.categories.undo'), onClick: () => void send(true) } });
      }
    } catch (e) {
      setError(rowErrorText(e, t));
    } finally {
      setOptimistic(null);
      busy.current = false;
    }
  };

  const checked = groupActive && (optimistic ?? item.active);
  const reason = groupActive ? null : item.active ? 'byGroup' : 'byItem';
  return (
    <>
      <span className="gp-row__state">
        {reason && <span className="tag tag--outline">{t(`catalog.categories.${reason}`)}</span>}
        <Switch
          checked={checked}
          label={name}
          text={t(checked ? 'catalog.categories.itemActive' : 'catalog.categories.itemInactive')}
          disabled={!groupActive}
          describedBy={groupActive ? undefined : hintId}
          onChange={(next) => void send(next)}
        />
      </span>
      {error && (
        <span className="gp-row__error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
