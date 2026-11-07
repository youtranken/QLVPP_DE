import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/features/catalog/catalog.api';
import { DialogCloseButton, DialogDescription, DialogTitle } from '@/ui/dialog';
import { Stepper } from '@/ui/stepper';
import { groupTone, type Tone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { useAdminContact, useRequestFormat } from './request-format';
import type { CartLine } from './use-cart';

const REVIEW_TONE = { pending: 'tag--warn', accepted: 'tag--ok', rejected: 'tag--danger' } as const;

// Nhãn ngoài DM luôn hiện; trạng thái xem chỉ có khi dòng đã lưu. Kỳ đang mở Hành chính chưa xem → nói giờ bắt đầu xem
function CustomTags({ line, lockAt }: { line: CartLine; lockAt?: string }) {
  const { t } = useTranslation();
  const status = line.id && line.review_status && line.review_status in REVIEW_TONE ? line.review_status : null;
  const text = status === 'pending' && lockAt ? t('request.cart.review.pendingOpen', { lock: lockAt }) : status && t(`request.cart.review.${status}`);
  return (
    <>
      <span className="tag tag--info">{t('request.cart.custom')}</span>
      {status && <span className={`tag ${REVIEW_TONE[status as keyof typeof REVIEW_TONE]}`}>{text}</span>}
    </>
  );
}

function CartRow({
  line,
  error,
  tone,
  lockAt,
  view,
  onQty,
  onRemove,
  onEdit,
}: {
  line: CartLine;
  error?: string;
  tone: Tone;
  lockAt?: string;
  view: boolean;
  onQty: (n: number) => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const contact = useAdminContact();
  const errorId = useId();
  const name = fmt.name(line.label);
  const lowered = !!line.lowered && !line.readonly && line.qty > line.lowered.max;
  const alert = lowered || !!line.stopped;
  return (
    <li className={`rq-line${error ? ' is-error' : alert ? ' is-alert' : ''}`} data-line-key={line.key} tabIndex={-1}>
      <ItemThumb fileId={line.label.image_file_id} alt="" tone={tone} size={42} />
      <div className="rq-line-main">
        {!line.item_id && !line.readonly && !view ? (
          <button type="button" className="rq-line-name rq-line-link" aria-label={t('request.cart.edit', { name })} title={name} onClick={onEdit}>
            {name}
          </button>
        ) : (
          <span className="rq-line-name" title={name}>{name}</span>
        )}
        <span className="rq-line-qty num">{t('request.cart.qty', { qty: line.qty, unit: fmt.unit(line.label.unit) })}</span>
        {!line.item_id && <CustomTags line={line} lockAt={lockAt} />}
        {line.review_status === 'converted' && <span className="tag tag--ok">{t('request.cart.review.converted')}</span>}
        {lowered && <span className="rq-line-alert">{t('request.cart.loweredMax', { max: line.lowered!.max, qty: line.qty })}</span>}
        {line.stopped && <span className="rq-line-alert">{t('request.cart.stopped')}</span>}
        {line.added_by_admin && (
          <span className="tag" title={t('request.cart.adminAddedHint', { contact })}>
            {t('request.cart.adminAdded')}
          </span>
        )}
      </div>
      {!line.readonly && !view && (
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
  lockAt,
  canSave,
  panelRef,
  mode = 'edit',
  onEditStart,
  onCancelEdit,
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
  // Câu khóa sổ của kỳ đang mở (dòng ngoài DM: "Hành chính xem từ …")
  lockAt?: string;
  canSave: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  // view = phiếu đã lưu chưa sửa: không ô số lượng, nút chính "Sửa phiếu"
  mode?: 'view' | 'edit';
  onEditStart?: () => void;
  // Đang sửa phiếu đã lưu: bỏ mọi thay đổi, về chế độ xem
  onCancelEdit?: () => void;
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
  const viewSaved = mode === 'view' ? saved : null;
  const view = !!viewSaved;
  const mainRef = useRef<HTMLButtonElement>(null);
  const canCancel = !view && !!saved && !!onCancelEdit;
  // Chưa đổi gì thì nút chính là "Hủy" (cùng một nút với "Sửa phiếu" để giữ focus), không để nút Lưu vô hiệu làm ngõ cụt
  const cancelOnly = canCancel && !dirty;
  const cancel = () => {
    onCancelEdit?.();
    mainRef.current?.focus();
  };
  return (
    <Root className={`rq-cart${sheet ? ' rq-cart--sheet' : ''}`} labelledBy={sheet ? undefined : titleId} panelRef={panelRef}>
      <div className="rq-cart-head">
        <div>
          <Title id={titleId} sheet={sheet}>{t('request.cart.title', { month })}</Title>
          <Summary sheet={sheet}>{t('request.cart.summary', { kinds: lines.length, units })}</Summary>
        </div>
        <span className={`rq-cart-chip${isSaved ? ' is-saved' : ''}`}>
          {viewSaved ? t('request.cart.statusSavedAt', { time: viewSaved.time }) : t(isSaved ? 'request.cart.statusSaved' : 'request.cart.statusDirty')}
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
              lockAt={lockAt}
              view={view}
              onQty={(n) => onQty(l.key, n)}
              onRemove={() => onRemove(l.key)}
              onEdit={() => onEdit(l.key)}
            />
          ))}
        </ul>
      )}
      {!view && (
        <button type="button" className="rq-ghost" onClick={onAddCustom}>
          + {t('request.cart.addOther')}
        </button>
      )}
      {showSave && (
        <button
          type="button"
          ref={mainRef}
          className={`btn btn--primary btn--xl btn--block rq-cart-save${cancelOnly ? ' is-cancel' : ''}`}
          disabled={!view && !cancelOnly && !canSave}
          onClick={view ? onEditStart : cancelOnly ? cancel : onSave}
        >
          {view ? t('request.cart.editOrder') : cancelOnly ? t('request.cart.cancelEdit') : saveLabel}
        </button>
      )}
      {showSave && canCancel && dirty && (
        <button type="button" className="btn btn--block rq-cart-cancel" onClick={cancel}>
          {t('request.cart.cancelEdit')}
        </button>
      )}
      <p className="rq-cart-note">
        {viewSaved
          ? t('request.cart.noteClosed', { date: viewSaved.lastDay })
          : saved && !dirty
          ? t('request.cart.noteSaved', { time: saved.time, date: saved.lastDay })
          : t('request.cart.noteUnsaved')}
      </p>
    </Root>
  );
}
