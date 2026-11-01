import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import { InlineText } from '@/ui/inline-text';
import { Switch } from '@/ui/switch';
import { unitErrorKey } from './unit-errors';
import type { AdminUnit, UnitPayload } from './units.api';

const NAME_MAX = 40;

interface Props {
  ordered: AdminUnit[];
  busy: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onPatch: (u: AdminUnit, body: UnitPayload) => Promise<void>;
  onToggleActive: (u: AdminUnit) => void;
  onDelete: (u: AdminUnit) => void;
}

export function UnitTable({ ordered, busy, onMove, onPatch, onToggleActive, onDelete }: Props) {
  const { t } = useTranslation();
  const errorText = (e: unknown) => t(unitErrorKey(e));
  return (
    <div className="table-wrap">
      <table className="table table-stack un-table">
        <thead>
          <tr>
            <th>{t('units.page.colOrder')}</th>
            <th>{t('units.page.colName')}</th>
            <th>{t('units.page.colNameEn')}</th>
            <th className="num r">{t('units.page.colItems')}</th>
            <th>{t('units.page.colStatus')}</th>
            <th>{t('units.page.colActive')}</th>
            <th aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {ordered.map((u, i) => (
            <tr key={u.code} className={u.active ? undefined : 'is-inactive'}>
              <td className="un-order">
                <button type="button" className="btn btn--ghost btn--sm ct-icon-btn" aria-label={t('units.page.moveUp', { name: u.name })} disabled={busy || i === 0} onClick={() => onMove(i, -1)}>
                  <Icon name="chevup" size={18} />
                </button>
                <button type="button" className="btn btn--ghost btn--sm ct-icon-btn" aria-label={t('units.page.moveDown', { name: u.name })} disabled={busy || i === ordered.length - 1} onClick={() => onMove(i, 1)}>
                  <Icon name="chev" size={18} />
                </button>
                <span className="num un-order__n">{i + 1}</span>
              </td>
              <td className="un-name">
                <InlineText value={u.name} label={t('units.page.editName', { name: u.name })} maxLength={NAME_MAX} onCommit={(name) => onPatch(u, { name })} formatError={errorText} />
              </td>
              <td data-label={t('units.page.colNameEn')}>
                <InlineText
                  value={u.name_en ?? ''}
                  label={t('units.page.editNameEn', { name: u.name })}
                  maxLength={NAME_MAX}
                  placeholder={t('common.empty')}
                  onCommit={(text) => onPatch(u, { name_en: text || null })}
                  formatError={errorText}
                />
              </td>
              <td className="num r" data-label={t('units.page.colItems')}>{u.item_count}</td>
              <td data-label={t('units.page.colStatus')}>
                <span className={u.active ? 'tag tag--ok' : 'tag tag--outline'}>{t(u.active ? 'units.page.active' : 'units.page.inactive')}</span>
              </td>
              <td data-label={t('units.page.colActive')}>
                <Switch checked={u.active} disabled={busy} label={t(u.active ? 'units.page.deactivateLabel' : 'units.page.reactivateLabel', { name: u.name })} onChange={() => onToggleActive(u)} />
              </td>
              <td>
                {!u.in_use && (
                  <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={() => onDelete(u)}>
                    {t('units.page.delete', { name: u.name })}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
