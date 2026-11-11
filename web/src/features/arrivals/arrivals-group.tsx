import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useSelectOnFocus } from '@/ui/use-select-on-focus';
import type { Tone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { useRequestFormat } from '@/features/request/request-format';
import { isReceivable, isReceivedFull, type ArrivalRow, type ArrivalSection } from './arrival-rows';
import { groupCounts, partialReceive, shortOf, statusCell, type ArrivalState, type ArrivalStatus } from './arrival-status';
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
    r.adm_out && !isReceivedFull(r) && t('arrivals.admOutStock', { s: r.stock }),
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

// Gõ thiếu: một dòng chữ đỏ (không phải chip) báo phần NCC còn nợ; còn lại là chip trạng thái
function StatusTag({ r, qty }: { r: ArrivalRow; qty: number }) {
  const { t } = useTranslation();
  const cell = statusCell(r, qty);
  if (cell.kind === 'owe') return <span className="ar-owe">{t('arrivals.status.owe', { qty: cell.qty, n: cell.n })}</span>;
  return <span className={`tag ${TAG_CLASS[cell.status.state]}`}>{stateText(t, cell.status)}</span>;
}

function ArrivalRowView({ r, draft, busy, showShort, onToggleAdm }: RowProps) {
  const { t } = useTranslation();
  // Bấm vào ô thì tô hết số để gõ đè
  const selectAll = useSelectOnFocus();
  const fmt = useRequestFormat();
  const n = (v: number) => v.toLocaleString('vi-VN');
  const name = fmt.name(r);
  const error = draft.errorOf(r);
  const qty = draft.qtyOf(r);
  const errId = `ar-err-${r.item_id}`;
  // Đã nhận đủ: khóa ô ở UI, sai thì chỉnh ở Tủ / Kho
  const locked = isReceivedFull(r);
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
        {locked ? (
          <span className="ar-full">✓ {t('arrivals.table.fullLocked')}</span>
        ) : (
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
              onFocus={selectAll}
              onBlur={() => draft.blur(r.item_id)}
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
        )}
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

export interface GroupPick {
  picked: boolean;
  // Có lỗi ô số hoặc không còn dòng nào > 0 hay đang lưu: nút nhóm tắt
  canReceive: boolean;
  onPick: (on: boolean) => void;
  onReceive: () => void;
}

interface Props {
  section: ArrivalSection;
  draft: ArrivalsDraft;
  admBusy: ReadonlySet<string>;
  showShort: boolean;
  columns: number;
  pick: GroupPick;
  onToggleAdm: (r: ArrivalRow) => void;
}

export function ArrivalsGroup({ section, draft, admBusy, showShort, columns, pick, onToggleAdm }: Props) {
  const { t } = useTranslation();
  const { done, total } = groupCounts(section.all);
  const partial = partialReceive(section.all, draft.qtyOf);
  // Mọi dòng đã nhận đủ hoặc ADM hết hàng: không còn gì để nhận
  const open = section.all.some(isReceivable);
  return (
    <tbody aria-label={section.label}>
      <tr className="ar-ghead">
        <th colSpan={columns} scope="rowgroup">
          <div className="ar-ghead__in">
            <input
              type="checkbox"
              className="ar-pick"
              aria-label={t('arrivals.group.pick', { name: section.label })}
              checked={open && pick.picked}
              disabled={!open}
              onChange={(e) => pick.onPick(e.target.checked)}
            />
            <b>{section.label}</b>
            <span>· {t('arrivals.group.done', { a: done, b: total })}</span>
            {open && (
              <button
                type="button"
                className="btn btn--sm"
                aria-label={t(partial ? 'arrivals.group.receiveFor' : 'arrivals.group.receiveFullFor', { name: section.label })}
                disabled={!pick.canReceive}
                onClick={pick.onReceive}
              >
                {t(partial ? 'arrivals.group.receive' : 'arrivals.group.receiveFull')}
              </button>
            )}
          </div>
        </th>
      </tr>
      {section.rows.map((r) => (
        <ArrivalRowView key={r.item_id} r={r} draft={draft} busy={admBusy.has(r.item_id)} showShort={showShort} onToggleAdm={onToggleAdm} />
      ))}
    </tbody>
  );
}
