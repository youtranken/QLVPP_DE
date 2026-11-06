import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { Switch } from '@/ui/switch';
import type { ToastSpec } from '@/ui/toast-context';
import { patchItem, type AdminItem } from './catalog.api';
import { rowErrorText } from './catalog-errors';

interface Props {
  item: AdminItem;
  name: string;
  groupActive: boolean;
  hintId?: string;
  refresh: () => Promise<unknown>;
  notify: (toast: ToastSpec) => void;
}

// Ghi ngay, cập nhật lạc quan; một request mỗi món (bấm lần hai khi đang gửi bị bỏ qua)
export function GroupItemSwitch({ item, name, groupActive, hintId, refresh, notify }: Props) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const busy = useRef(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (active: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setOptimistic(active);
    setError(null);
    try {
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
