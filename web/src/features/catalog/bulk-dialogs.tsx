import { useId, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSingleFlight } from '@/lib/use-single-flight';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { Icon } from '@/ui/icon';
import { categoryLabel, type Category } from './catalog.api';
import { indexCategories } from './catalog-rows';

const MAX_QTY_MIN = 1;
const MAX_QTY_MAX = 999;

function BulkDialog({ title, submitLabel, pending, onSubmit, onClose, children }: {
  title: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dismissible={!pending} className="sheet a-form" maxWidth={440}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{title}</DialogTitle>
          <DialogClose asChild>
            <button type="button" className="sheet-close" aria-label={t('common.close')} disabled={pending}>
              <Icon name="x" />
            </button>
          </DialogClose>
        </div>
        <div className="sheet-body">{children}</div>
        <div className="sheet-footer">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost" disabled={pending}>
              {t('common.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={pending} aria-busy={pending}>
            {pending ? t('catalog.form.saving') : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

// Chỉ đỡ người dùng gõ nhầm; server vẫn kiểm 1–999 cho từng món (VALIDATION → câu lỗi ở hàng)
const validMaxQty = (raw: string) => /^\d+$/.test(raw.trim()) && Number(raw) >= MAX_QTY_MIN && Number(raw) <= MAX_QTY_MAX;

export function BulkMaxDialog({ count, onSubmit, onClose }: { count: number; onSubmit: (n: number) => Promise<void>; onClose: () => void }) {
  const { t } = useTranslation();
  const flight = useSingleFlight();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const submit = () => {
    if (!validMaxQty(value)) return setError(t('catalog.list.maxRange'));
    void flight.run(() => onSubmit(Number(value)));
  };
  return (
    <BulkDialog title={t('catalog.bulk.maxTitle', { n: count })} submitLabel={t('catalog.bulk.max')} pending={flight.pending} onSubmit={submit} onClose={onClose}>
      <FormField label={t('catalog.form.maxQty')} required error={error} hint={error ? undefined : t('catalog.bulk.maxHint')}>
        {(control) => (
          <input
            {...control}
            className="a-input num"
            type="number"
            inputMode="numeric"
            min={MAX_QTY_MIN}
            max={MAX_QTY_MAX}
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(undefined);
            }}
          />
        )}
      </FormField>
    </BulkDialog>
  );
}

export function BulkMoveDialog({ count, categories, onSubmit, onClose }: {
  count: number;
  categories: Category[];
  onSubmit: (category: Category) => Promise<void>;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const flight = useSingleFlight();
  const uid = useId();
  const [target, setTarget] = useState<Category | null>(null);
  const [error, setError] = useState(false);
  const active = categories.filter((c) => c.active);
  const tones = useMemo(() => indexCategories(categories).tone, [categories]);
  const submit = () => {
    if (!target) return setError(true);
    void flight.run(() => onSubmit(target));
  };
  return (
    <BulkDialog title={t('catalog.bulk.moveTitle', { n: count })} submitLabel={t('catalog.bulk.move')} pending={flight.pending} onSubmit={submit} onClose={onClose}>
      <div className="ff">
        <span id={`${uid}-label`} className="ff-label">
          {t('catalog.bulk.moveTarget')}
          <span className="ff-req" aria-hidden="true"> *</span>
        </span>
        <div role="radiogroup" aria-labelledby={`${uid}-label`} aria-describedby={error ? `${uid}-err` : undefined} className="ct-chips ct-chips--wrap">
          {active.map((c) => {
            const tone = tones.get(c.id) ?? 'g0';
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={target?.id === c.id}
                className="ct-chip"
                onClick={() => {
                  setTarget(c);
                  setError(false);
                }}
              >
                <span className="ct-dot" style={{ background: `var(--${tone}-ink)` }} aria-hidden="true" />
                {categoryLabel(c, i18n.language)}
              </button>
            );
          })}
        </div>
        {error && (
          <p id={`${uid}-err`} className="ff-error">
            {t('catalog.bulk.moveRequired')}
          </p>
        )}
      </div>
    </BulkDialog>
  );
}
