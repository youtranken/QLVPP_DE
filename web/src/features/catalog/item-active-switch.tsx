import { useTranslation } from 'react-i18next';
import { Switch } from '@/ui/switch';
import { useItemActive, type ItemActiveArgs } from './use-item-active';
import './categories.m1.css';

// Công tắc "Đang dùng / Ngừng" của một món — panel nhóm và panel món dùng chung
export function ItemActiveSwitch({ hintId, ...args }: ItemActiveArgs & { hintId?: string }) {
  const { t } = useTranslation();
  const { checked, locked, reason, error, send } = useItemActive(args);
  return (
    <>
      <span className="gp-row__state">
        {reason && <span className="tag tag--outline">{t(`catalog.categories.${reason}`)}</span>}
        <Switch
          checked={checked}
          label={args.name}
          text={t(checked ? 'catalog.categories.itemActive' : 'catalog.categories.itemInactive')}
          disabled={locked}
          describedBy={locked ? hintId : undefined}
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
