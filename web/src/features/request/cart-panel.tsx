import { useId, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/features/catalog/catalog.api';
import { DialogCloseButton, DialogDescription, DialogTitle } from '@/ui/dialog';
import { Stepper } from '@/ui/stepper';
import { groupTone, type Tone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { useAdminContact, useRequestFormat } from './request-format';
import type { CartLine } from './use-cart';

const REVIEW_TONE = { pending: 'tag--warn', accepted: 'tag--ok', rejected: 'tag--danger' } as const;

// Nhãn ngoài DM luôn hiện; trạng thái xem chỉ có khi dòng đã lưu
function CustomTags({ line }: { line: CartLine }) {
  const { t } = useTranslation();
  const status = line.id && line.review_status && line.review_status in REVIEW_TONE ? line.review_status : null;
  return (
    <>
      <span className="tag tag--info">{t('request.cart.custom')}</span>
      {status && (
        <span className={`tag ${REVIEW_TONE[status as keyof typeof REVIEW_TONE]}`}>{t(`request.cart.review.${status}`)}</span>
      )}
    </>
  );
}

function CartRow({
  line,
  error,
  tone,
  onQty,
  onRemove,
  onEdit,
}: {
  line: CartLine;
  error?: string;
  tone: Tone;
  onQty: (n: number) => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const contact = useAdminContact();
  const errorId = useId();
  const name = fmt.name(line.label);
  return (
    <li className={`rq-line${error ? ' is-error' : ''}`} data-line-key={line.key} tabIndex={-1}>
      <ItemThumb fileId={line.label.image_file_id} alt="" tone={tone} size={42} />
      <div className="rq-line-main">
        {!line.item_id && !line.readonly ? (
          <button type="button" className="rq-line-name rq-line-link" aria-label={t('request.cart.edit', { name })} title={name} onClick={onEdit}>
            {name}
          </button>
        ) : (
          <span className="rq-line-name" title={name}>{name}</span>
        )}
        <span className="rq-line-qty num">{t('request.cart.qty', { qty: line.qty, unit: fmt.unit(line.label.unit) })}</span>
        {!line.item_id && <CustomTags line={line} />}
        {line.review_status === 'converted' && <span className="tag tag--ok">{t('request.cart.review.converted')}</span>}
        {line.added_by_admin && (
          <span className="tag" title={t('request.cart.adminAddedHint', { contact })}>
            {t('request.cart.adminAdded')}
          </span>
        )}
      </div>
      {!line.readonly && (
        <>
          <Stepper
            className="rq-line-stepper"
            value={line.qty}
            min={line.min}
            max={line.max}
            label={name}
            onChange={onQty}
            describedBy={error ? errorId : undefined}
            invalid={!!error}
          />
          <button type="button" className="rq-line-x" aria-label={t('request.cart.remove', { name })} onClick={onRemove}>
            ×
          </button>
        </>
      )}
      {error && (
        <p id={errorId} className="rq-line-error">
          {error}
        </p>
      )}
    </li>
  );
}

// Máy tính: aside "complementary" có tên; sheet: nằm trong dialog nên là div, tên lấy từ DialogTitle
function Root({ className, labelledBy, panelRef, children }: { className: string; labelledBy?: string; panelRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  if (labelledBy) return <aside className={className} aria-labelledby={labelledBy} ref={panelRef}>{children}</aside>;
  return <div className={className} ref={panelRef}>{children}</div>;
}

function Title({ id, sheet, children }: { id: string; sheet: boolean; children: ReactNode }) {
  return sheet ? <DialogTitle asChild><h2>{children}</h2></DialogTitle> : <h2 id={id}>{children}</h2>;
}

function Summary({ sheet, children }: { sheet: boolean; children: ReactNode }) {
  return sheet ? (
    <DialogDescription asChild><p className="rq-cart-sum num">{children}</p></DialogDescription>
  ) : (
    <p className="rq-cart-sum num">{children}</p>
  );
}

export function CartPanel({
  lines,
  errors,
  categories,
  month,
  prevMonth,
  dirty,
  saved,
  showSave,
  sheet = false,
  saveLabel,
  canSave,
  panelRef,
  onQty,
  onRemove,
  onSave,
  onAddCustom,
  onEdit,
}: {
  lines: CartLine[];
  errors: Record<string, string>;
  categories: Category[];
  month: number;
  prevMonth: number | null;
  dirty: boolean;
  saved: { time: string; lastDay: string } | null;
  showSave: boolean;
  // Trong sheet điện thoại: h2 là tiêu đề dialog, có nút đóng; nút Lưu nằm đáy, ngoài danh sách cuộn
  sheet?: boolean;
  saveLabel: string;
  canSave: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  onQty: (key: string, n: number) => void;
  onRemove: (key: string) => void;
  onSave: () => void;
  onAddCustom: () => void;
  onEdit: (key: string) => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const units = lines.reduce((sum, l) => sum + l.qty, 0);
  const isSaved = !!saved && !dirty;
  return (
    <Root className={`rq-cart${sheet ? ' rq-cart--sheet' : ''}`} labelledBy={sheet ? undefined : titleId} panelRef={panelRef}>
      <div className="rq-cart-head">
        <div>
          <Title id={titleId} sheet={sheet}>{t('request.cart.title', { month })}</Title>
          <Summary sheet={sheet}>{t('request.cart.summary', { kinds: lines.length, units })}</Summary>
        </div>
        <span className={`rq-cart-chip${isSaved ? ' is-saved' : ''}`}>
          {t(isSaved ? 'request.cart.statusSaved' : 'request.cart.statusDirty')}
        </span>
        {sheet && <DialogCloseButton />}
      </div>
      {lines.length === 0 ? (
        <p className="rq-cart-empty">
          {prevMonth ? t('request.cart.emptyCopy', { month: prevMonth }) : t('request.cart.empty')}
        </p>
      ) : (
        <ul className="rq-lines">
          {lines.map((l) => (
            <CartRow
              key={l.key}
              line={l}
              error={errors[l.key]}
              tone={groupTone(categories, l.label.category_id)}
              onQty={(n) => onQty(l.key, n)}
              onRemove={() => onRemove(l.key)}
              onEdit={() => onEdit(l.key)}
            />
          ))}
        </ul>
      )}
      <button type="button" className="rq-ghost" onClick={onAddCustom}>
        + {t('request.cart.addOther')}
      </button>
      {showSave && (
        <button type="button" className="btn btn--primary btn--xl btn--block rq-cart-save" disabled={!canSave} onClick={onSave}>
          {saveLabel}
        </button>
      )}
      <p className="rq-cart-note">
        {saved && !dirty
          ? t('request.cart.noteSaved', { time: saved.time, date: saved.lastDay })
          : t('request.cart.noteUnsaved')}
      </p>
    </Root>
  );
}
