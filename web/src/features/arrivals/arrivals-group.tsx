import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Tone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { useRequestFormat } from '@/features/request/request-format';
import type { ArrivalRow, ArrivalSection } from './arrival-rows';
import { afterState, groupCounts, savedState, shortOf, type ArrivalState, type ArrivalStatus } from './arrival-status';
import type { ArrivalsDraft } from './use-arrivals-draft';

const THUMB_TONE: Tone = 'g0';
const TAG_CLASS: Record<ArrivalState, string> = { short: 'tag--warn', over: 'tag--info', done: 'tag--ok', none: 'tag--outline', adm_out: 'tag--outline' };

interface RowProps {
  r: ArrivalRow;
  draft: ArrivalsDraft;
  busy: boolean;
  showShort: boolean;
  onToggleAdm: (r: ArrivalRow) => void;
}

function RowNotes({ r }: { r: ArrivalRow }) {
  const { t } = useTranslation();
  const notes = [
    r.reduced > 0 && t('warn.W14row', { n: r.reduced }),
    r.added && t('warn.W16'),
    !r.usable && t('arrivals.inactiveOrdered'),
    r.adm_out && r.stock > 0 && t('warn.W17', { s: r.stock, n: Math.max(0, r.remaining - r.stock) }),
  ].filter((n): n is string => Boolean(n));
  return notes.map((n) => (
    <small key={n} className="ar-note">
      {n}
    </small>
  ));
}

function InactiveTag({ reason }: { reason: ArrivalRow['inactive_reason'] }) {
  const { t } = useTranslation();
  if (!reason) return null;
  return <span className="tag tag--outline">{t(reason === 'item' ? 'catalog.categories.byItem' : 'catalog.categories.byGroup')}</span>;
}

function stateText(t: TFunction, st: ArrivalStatus) {
  return t(`arrivals.status.${st.state}`, { n: st.n });
}

// Chip nền = đã lưu; chip viền đứt = sau khi bấm "Lưu hàng về"
function StatusTag({ r, qty }: { r: ArrivalRow; qty: number }) {
  const { t } = useTranslation();
  const saved = savedState(r);
  const after = afterState(r, qty);
  return (
    <>
      <span className={`tag ${TAG_CLASS[saved.state]}`}>{stateText(t, saved)}</span>
      {after && <span className="ar-after-chip">{t('arrivals.status.after', { label: stateText(t, after) })}</span>}
    </>
  );
}

function ArrivalRowView({ r, draft, busy, showShort, onToggleAdm }: RowProps) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const n = (v: number) => v.toLocaleString('vi-VN');
  const name = fmt.name(r);
  const error = draft.errorOf(r);
  const qty = draft.qtyOf(r);
  const errId = `ar-err-${r.item_id}`;
  return (
    <tr className={r.adm_out ? 'ar-row--out' : undefined}>
      <td className="ar-item">
        <div className="ar-item__in">
          <ItemThumb fileId={r.image_file_id} alt="" tone={THUMB_TONE} size={36} />
          <span>
            <b>{name}</b>
            <small>{fmt.unit(r.unit)}</small>
            {!r.usable && <InactiveTag reason={r.inactive_reason} />}
            <RowNotes r={r} />
          </span>
        </div>
      </td>
      <td className="n" data-label={t('arrivals.table.stock')}>{n(r.stock)}</td>
      <td className="n" data-label={t('arrivals.table.ordered')}>
        {n(r.ordered)}
        {r.received > 0 && <small className="ar-received">{t('arrivals.table.receivedSmall', { n: n(r.received) })}</small>}
      </td>
      <td className="n ar-qty" data-label={t('arrivals.table.qty')}>
        <div className="ar-qty__in">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            aria-label={t('arrivals.table.qtyLabel', { name })}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errId : undefined}
            disabled={r.adm_out}
            value={draft.textOf(r)}
            onChange={(e) => draft.change(r.item_id, e.target.value)}
          />
          {!r.added && (
            <button
              type="button"
              className="ar-adm"
              aria-pressed={r.adm_out}
              aria-label={t(r.adm_out_final ? 'arrivals.admOut.finalFor' : 'arrivals.admOut.buttonFor', { name })}
              disabled={r.adm_out_final || busy}
              onClick={() => onToggleAdm(r)}
            >
              {t(r.adm_out_final ? 'arrivals.admOut.final' : 'arrivals.admOut.button')}
            </button>
          )}
        </div>
        {error && (
          <small id={errId} className="ar-err">
            {t(`arrivals.errors.${error}`)}
          </small>
        )}
      </td>
      {showShort && (
        <td className="n" data-label={t('arrivals.table.short')}>
          {r.adm_out ? '–' : n(shortOf(r, qty))}
        </td>
      )}
      <td data-label={t('arrivals.table.status')}>
        <StatusTag r={r} qty={qty} />
      </td>
      <td className="n ar-after" data-label={t('arrivals.table.after')}>{n(r.stock + qty)}</td>
    </tr>
  );
}

interface Props {
  section: ArrivalSection;
  draft: ArrivalsDraft;
  admBusy: ReadonlySet<string>;
  showShort: boolean;
  columns: number;
  onToggleAdm: (r: ArrivalRow) => void;
}

export function ArrivalsGroup({ section, draft, admBusy, showShort, columns, onToggleAdm }: Props) {
  const { t } = useTranslation();
  const { done, total, doneAfter } = groupCounts(section.all, draft.qtyOf);
  return (
    <tbody aria-label={section.label}>
      <tr className="ar-ghead">
        <th colSpan={columns} scope="rowgroup">
          <div className="ar-ghead__in">
            <b>{section.label}</b>
            <span>· {doneAfter === done ? t('arrivals.group.done', { a: done, b: total }) : t('arrivals.group.doneAfter', { a: done, b: total, c: doneAfter })}</span>
            <button type="button" className="btn btn--sm" onClick={() => draft.fill(section.all)}>
              {t('arrivals.group.fill')}
            </button>
          </div>
        </th>
      </tr>
      {section.rows.map((r) => (
        <ArrivalRowView key={r.item_id} r={r} draft={draft} busy={admBusy.has(r.item_id)} showShort={showShort} onToggleAdm={onToggleAdm} />
      ))}
    </tbody>
  );
}
