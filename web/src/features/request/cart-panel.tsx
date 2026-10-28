import { useId, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { Category } from '@/features/catalog/catalog.api';
import { useMe } from '@/lib/me';
import { Stepper } from '@/ui/stepper';
import { ItemThumb } from './item-card';
import { tintOf, useAdminContact, useRequestFormat } from './request-format';
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
  tint,
  onQty,
  onRemove,
  onEdit,
}: {
  line: CartLine;
  error?: string;
  tint: string;
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
      <ItemThumb name={name} imageId={line.label.image_file_id} tint={tint} className="rq-line-img" />
      <div className="rq-line-main">
        {!line.item_id && !line.readonly ? (
          <button type="button" className="rq-line-name rq-line-link" aria-label={t('request.cart.edit', { name })} onClick={onEdit}>
            {name}
          </button>
        ) : (
          <span className="rq-line-name">{name}</span>
        )}
        {!line.item_id && <CustomTags line={line} />}
        {line.review_status === 'converted' && <span className="tag tag--ok">{t('request.cart.review.converted')}</span>}
        {line.added_by_admin && (
          <span className="tag" title={t('request.cart.adminAddedHint', { contact })}>
            {t('request.cart.adminAdded')}
          </span>
        )}
      </div>
      {line.readonly ? (
        <span className="rq-line-qty num">{t('request.cart.qty', { qty: line.qty, unit: fmt.unit(line.label.unit) })}</span>
      ) : (
        <div className="rq-line-edit">
          <Stepper
            className="stepper--sm"
            value={line.qty}
            min={1}
            max={line.max}
            label={name}
            onChange={onQty}
            describedBy={error ? errorId : undefined}
            invalid={!!error}
          />
          <button type="button" className="rq-line-x" aria-label={t('request.cart.remove', { name })} onClick={onRemove}>
            ×
          </button>
        </div>
      )}
      {error && (
        <p id={errorId} className="rq-line-error">
          {error}
        </p>
      )}
    </li>
  );
}

export function CartPanel({
  lines,
  errors,
  categories,
  showSave,
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
  showSave: boolean;
  saveLabel: string;
  canSave: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onQty: (key: string, n: number) => void;
  onRemove: (key: string) => void;
  onSave: () => void;
  onAddCustom: () => void;
  onEdit: (key: string) => void;
}) {
  const { t } = useTranslation();
  const me = useMe();
  const titleId = useId();
  const units = lines.reduce((sum, l) => sum + l.qty, 0);
  return (
    <aside className="rq-cart" aria-labelledby={titleId} ref={panelRef}>
      <h2 id={titleId}>{t('request.cart.title')}</h2>
      <p className="rq-who">{[me.fullName, me.department].filter(Boolean).join(' · ')}</p>
      {lines.length === 0 ? (
        <p className="rq-cart-empty">{t('request.cart.empty')}</p>
      ) : (
        <ul className="rq-lines">
          {lines.map((l) => (
            <CartRow
              key={l.key}
              line={l}
              error={errors[l.key]}
              tint={tintOf(l.label.category_id, categories)}
              onQty={(n) => onQty(l.key, n)}
              onRemove={() => onRemove(l.key)}
              onEdit={() => onEdit(l.key)}
            />
          ))}
        </ul>
      )}
      <div className="rq-sum num">{t('request.cart.total', { kinds: lines.length, units })}</div>
      <button type="button" className="rq-ghost" onClick={onAddCustom}>
        + {t('request.cart.addOther')}
      </button>
      {showSave && (
        <button type="button" className="btn btn--primary btn--xl btn--block" disabled={!canSave} onClick={onSave}>
          {saveLabel}
        </button>
      )}
    </aside>
  );
}
