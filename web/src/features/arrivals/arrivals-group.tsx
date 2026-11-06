import { useTranslation } from 'react-i18next';
import type { Tone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { useRequestFormat } from '@/features/request/request-format';
import { arrivalTag, type ArrivalRow, type ArrivalSection } from './arrival-rows';
import type { ArrivalsDraft } from './use-arrivals-draft';

const THUMB_TONE: Tone = 'g0';
const TAG_CLASS = { short: 'tag--warn', over: 'tag--info', exact: 'tag--ok' } as const;

interface RowProps {
  r: ArrivalRow;
  draft: ArrivalsDraft;
  busy: boolean;
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

function StatusTag({ r, qty }: { r: ArrivalRow; qty: number }) {
  const { t } = useTranslation();
  if (r.adm_out) return <span className="tag tag--outline">{t('arrivals.admOut.tag')}</span>;
  const tag = arrivalTag(qty, r.remaining);
  const text = tag.kind === 'exact' ? t('arrivals.tag.exact') : t(tag.kind === 'short' ? 'warn.W13short' : 'warn.W13surplus', { n: tag.n });
  return <span className={`tag ${TAG_CLASS[tag.kind]}`}>{text}</span>;
}

function ArrivalRowView({ r, draft, busy, onToggleAdm }: RowProps) {
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
            <RowNotes r={r} />
          </span>
        </div>
      </td>
      <td className="n" data-label={t('arrivals.table.ordered')}>{n(r.ordered)}</td>
      <td className="n" data-label={t('arrivals.table.received')}>{n(r.received)}</td>
      <td className="n" data-label={t('arrivals.table.stock')}>{n(r.stock)}</td>
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
  onToggleAdm: (r: ArrivalRow) => void;
}

export function ArrivalsGroup({ section, draft, admBusy, onToggleAdm }: Props) {
  const { t } = useTranslation();
  const counted = section.all.filter((r) => !r.added);
  const done = counted.filter((r) => r.remaining === 0).length;
  const filled = draft.filled(section.id);
  return (
    <tbody aria-label={section.label}>
      <tr className="ar-ghead">
        <th colSpan={7} scope="rowgroup">
          <div className="ar-ghead__in">
            <b>{section.label}</b>
            <span>· {t('arrivals.group.done', { a: done, b: counted.length })}</span>
            <button type="button" className="btn btn--sm" onClick={() => (filled ? draft.unfill(section.id) : draft.fill(section.id, section.all))}>
              {t(filled ? 'arrivals.group.unfill' : 'arrivals.group.fill')}
            </button>
          </div>
        </th>
      </tr>
      {section.rows.map((r) => (
        <ArrivalRowView key={r.item_id} r={r} draft={draft} busy={admBusy.has(r.item_id)} onToggleAdm={onToggleAdm} />
      ))}
    </tbody>
  );
}
