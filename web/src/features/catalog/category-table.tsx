import { useTranslation } from 'react-i18next';
import { toneAtRank } from '@/lib/group-tone';
import { apiErrorCode } from '@/lib/api-error';
import { Icon } from '@/ui/icon';
import { InlineText } from '@/ui/inline-text';
import { Switch } from '@/ui/switch';
import type { Category, CategoryPayload } from './catalog.api';
import { catalogErrorKey } from './catalog-errors';

const NAME_MAX = 120;

interface Props {
  ordered: Category[];
  counts: Map<string, number>;
  busy: boolean;
  onMove: (index: number, dir: -1 | 1) => void;
  onPatch: (c: Category, body: CategoryPayload) => Promise<void>;
  onToggleActive: (c: Category) => void;
}

export function CategoryTable({ ordered, counts, busy, onMove, onPatch, onToggleActive }: Props) {
  const { t } = useTranslation();
  const errorText = (e: unknown) => t(apiErrorCode(e) === 'VALIDATION' ? 'catalog.errors.FIELD_INVALID' : catalogErrorKey(e));
  return (
    <div className="table-wrap">
      <table className="table table-stack cg-table">
        <thead>
          <tr>
            <th>{t('catalog.categories.colOrder')}</th>
            <th>{t('catalog.categories.colTone')}</th>
            <th>{t('catalog.categories.colName')}</th>
            <th>{t('catalog.categories.colNameEn')}</th>
            <th className="num r">{t('catalog.categories.colItems')}</th>
            <th>{t('catalog.categories.colStatus')}</th>
            <th>{t('catalog.categories.colActive')}</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((c, i) => {
            const tone = toneAtRank(i);
            return (
              <tr key={c.id} className={c.active ? undefined : 'is-inactive'}>
                <td className="cg-order">
                  <button type="button" className="btn btn--ghost btn--sm ct-icon-btn" aria-label={t('catalog.categories.moveUp', { name: c.name })} disabled={busy || i === 0} onClick={() => onMove(i, -1)}>
                    <Icon name="chevup" size={18} />
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm ct-icon-btn" aria-label={t('catalog.categories.moveDown', { name: c.name })} disabled={busy || i === ordered.length - 1} onClick={() => onMove(i, 1)}>
                    <Icon name="chev" size={18} />
                  </button>
                  <span className="num cg-order__n">{i + 1}</span>
                </td>
                <td>
                  <span className="ct-dot cg-dot" style={{ background: `var(--${tone}-ink)` }} title={t(`catalog.tones.${tone}`)} />
                </td>
                <td className="cg-name">
                  <InlineText value={c.name} label={t('catalog.categories.editName', { name: c.name })} maxLength={NAME_MAX} onCommit={(name) => onPatch(c, { name })} formatError={errorText} />
                </td>
                <td data-label={t('catalog.categories.colNameEn')}>
                  <InlineText
                    value={c.name_en ?? ''}
                    label={t('catalog.categories.editNameEn', { name: c.name })}
                    maxLength={NAME_MAX}
                    placeholder={t('common.empty')}
                    onCommit={(text) => onPatch(c, { name_en: text || null })}
                    formatError={errorText}
                  />
                </td>
                <td className="num r" data-label={t('catalog.categories.colItems')}>{counts.get(c.id) ?? 0}</td>
                <td data-label={t('catalog.categories.colStatus')}>
                  <span className={c.active ? 'tag tag--ok' : 'tag tag--outline'}>{t(c.active ? 'catalog.categories.active' : 'catalog.categories.inactive')}</span>
                </td>
                <td data-label={t('catalog.categories.colActive')}>
                  <Switch checked={c.active} disabled={busy} label={t(c.active ? 'catalog.categories.deactivateLabel' : 'catalog.categories.reactivateLabel', { name: c.name })} onChange={() => onToggleActive(c)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
