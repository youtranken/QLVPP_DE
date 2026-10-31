import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { groupTone } from '@/lib/group-tone';
import { ItemThumb } from '@/ui/item-thumb';
import { useAdminItems, useAllCategories } from '@/features/catalog/catalog.api';
import { useRequestFormat } from '@/features/request/request-format';
import { AddLinePicker } from './add-line-picker';
import { LineRow } from './adjust-line-row';

export interface CreateLine {
  item_id: string;
  qty: number;
}

export function CreateRequestLines({ lines, errors, missing, onChange }: {
  lines: CreateLine[];
  errors?: Record<string, string>;
  missing?: string;
  onChange: (lines: CreateLine[]) => void;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const noteId = useId();
  const items = useAdminItems();
  const cats = useAllCategories();
  const byId = useMemo(() => new Map((items.data ?? []).map((i) => [i.id, i])), [items.data]);
  const taken = new Set(lines.map((l) => l.item_id));
  const candidates = (items.data ?? []).filter((i) => i.active && !i.admin_only && !taken.has(i.id));
  const setQty = (itemId: string, qty: number) => onChange(lines.map((l) => (l.item_id === itemId ? { ...l, qty } : l)));

  return (
    <fieldset className={missing ? 'aj-create-lines ff--error' : 'aj-create-lines'} aria-describedby={missing ? noteId : undefined}>
      <legend className="ff-label">
        {t('summary.create.lines')}
        <span className="ff-req" aria-hidden="true"> *</span>
      </legend>
      {lines.length === 0 ? (
        <p className="sm-note">{t('summary.create.empty')}</p>
      ) : (
        <ul className="aj-lines">
          {lines.map((l) => {
            const item = byId.get(l.item_id);
            const unit = fmt.unit(item?.unit ?? null);
            return (
              <LineRow
                key={l.item_id}
                name={item ? fmt.name(item) : l.item_id}
                meta={item ? t('summary.adjust.meta', { unit, max: item.max_qty }) : unit}
                thumb={<ItemThumb fileId={item?.image_file_id ?? null} alt="" tone={groupTone(cats.data ?? [], item?.category_id ?? null)} size={48} />}
                qty={l.qty}
                min={1}
                max={item?.max_qty ?? l.qty}
                error={errors?.[l.item_id]}
                onQty={(n) => setQty(l.item_id, n)}
                onRemove={() => onChange(lines.filter((x) => x.item_id !== l.item_id))}
              />
            );
          })}
        </ul>
      )}
      <AddLinePicker items={candidates} onPick={(i) => onChange([...lines, { item_id: i.id, qty: 1 }])} />
      {missing && (
        <p id={noteId} className="ff-error">
          {missing}
        </p>
      )}
    </fieldset>
  );
}
