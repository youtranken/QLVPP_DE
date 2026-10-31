import { useContext, useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellContext } from '@tanstack/react-table';
import { part1Name, type Part1Row } from './report-part1-rows';
import { OrderQtyContext } from './use-order-qty';

// Component cấp module, đọc nháp qua context: cột dựng lại (ĐVT tải xong, đổi ngôn ngữ) không làm ô đang gõ mất focus
export function OrderColumnCell({ row }: CellContext<Part1Row, unknown>) {
  const { i18n } = useTranslation();
  const r = row.original;
  return <OrderCell rowKey={r.id} name={part1Name(r, i18n.language)} need={r.row.need} />;
}

function OrderCell({ rowKey, name, need }: { rowKey: string; name: string; need: number }) {
  const { t } = useTranslation();
  const qty = useContext(OrderQtyContext)!;
  const errId = useId();
  const error = qty.hasError(rowKey);
  const edited = qty.isEdited(rowKey);
  return (
    <div className={edited ? 'bc-order is-edited' : 'bc-order'}>
      <input
        className="bc-order__input num"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={qty.value(rowKey)}
        aria-label={t('reports.part1.orderLabel', { name })}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        onChange={(e) => qty.set(rowKey, e.target.value)}
      />
      {edited && (
        <button
          type="button"
          className="btn btn--ghost btn--sm bc-order__reset"
          aria-label={t('reports.part1.resetNeedLabel', { need, name })}
          onClick={() => qty.reset(rowKey)}
        >
          {t('reports.part1.resetNeed', { need })}
        </button>
      )}
      {error && (
        <p id={errId} className="bc-order__error">
          {t('reports.part1.orderInvalid')}
        </p>
      )}
    </div>
  );
}
