import { useId, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UnitSelect } from '@/features/units/unit-select';
import { unitsQuery } from '@/features/units/units.api';
import { Dialog, DialogClose, DialogCloseButton, DialogDescription, DialogTitle } from '@/ui/dialog';
import { FormField } from '@/ui/form-field';
import { Stepper } from '@/ui/stepper';
import type { CustomLineInput } from './use-cart';

const NAME_MAX = 120;
const NOTE_MAX = 500;
const DEFAULT_UNIT = 'cai';

export function CustomLineDialog({
  initial,
  maxQty,
  onSubmit,
  onClose,
}: {
  initial?: CustomLineInput;
  maxQty: number;
  onSubmit: (line: CustomLineInput) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(initial?.custom_name ?? '');
  const { data: units = [] } = useQuery(unitsQuery);
  const defaultUnit = units.some((u) => u.code === DEFAULT_UNIT && u.active) ? DEFAULT_UNIT : '';
  const [chosenUnit, setChosenUnit] = useState<string | null>(null);
  const baseUnit = initial?.custom_unit ?? defaultUnit;
  const unit = chosenUnit ?? baseUnit;
  const [qty, setQty] = useState(initial?.qty ?? 1);
  const [note, setNote] = useState(initial?.custom_note ?? '');
  const [touched, setTouched] = useState(false);

  const line: CustomLineInput = {
    custom_name: name.trim(),
    custom_unit: unit,
    custom_note: note.trim() || null,
    image_file_id: initial?.image_file_id ?? null,
    qty,
  };
  const hintId = useId();
  const atMaxId = useId();
  const missing = [
    !line.custom_name && t('request.custom.missingName'),
    !unit && t('request.custom.missingUnit'),
  ].filter(Boolean);
  const ready = missing.length === 0;
  const dirty =
    name !== (initial?.custom_name ?? '') ||
    unit !== baseUnit ||
    note !== (initial?.custom_note ?? '') ||
    qty !== (initial?.qty ?? 1);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (ready) onSubmit(line);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dirty={dirty} closeOnOutside={false} className="sheet rq-dialog" maxWidth={520}>
      <form onSubmit={submit} noValidate>
        <div className="sheet-header">
          <DialogTitle className="sheet-title">{t(initial ? 'request.custom.editTitle' : 'request.custom.addTitle')}</DialogTitle>
          <DialogCloseButton />
        </div>
        <div className="sheet-body rq-custom-form">
          <DialogDescription className="rq-custom-intro">{t('request.custom.intro')}</DialogDescription>
          <FormField label={t('request.custom.name')}>
            {(p) => <input {...p} className="rq-custom-input" value={name} maxLength={NAME_MAX} autoComplete="off" onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} />}
          </FormField>
          {touched && missing.length > 0 && (
            <p id={hintId} className="ff-hint rq-custom-missing">
              {t('request.custom.missing', { fields: missing.join(', ') })}
            </p>
          )}
          <div className="rq-custom-row">
            <FormField label={t('request.custom.unit')}>
              {(p) => <UnitSelect {...p} className="rq-custom-input" value={unit} onValueChange={setChosenUnit} />}
            </FormField>
            <div className="rq-custom-qty">
              <span className="ff-label" aria-hidden="true">
                {t('request.custom.qty')}
              </span>
              <Stepper value={qty} min={1} max={maxQty} label={t('request.custom.qty')} describedBy={atMaxId} onChange={setQty} />
            </div>
          </div>
          <p id={atMaxId} role="status" className="rq-custom-atmax">
            {qty >= maxQty ? t('request.custom.atMax', { max: maxQty }) : null}
          </p>
          <FormField label={t('request.custom.note')}>
            {(p) => (
              <textarea
                {...p}
                className="rq-custom-input"
                value={note}
                maxLength={NOTE_MAX}
                placeholder={t('request.custom.notePlaceholder')}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </FormField>
        </div>
        <div className="sheet-footer rq-custom-footer">
          <DialogClose asChild>
            <button type="button" className="btn">
              {t('request.custom.cancel')}
            </button>
          </DialogClose>
          <button type="submit" className="btn btn--primary" disabled={!ready} aria-describedby={touched && missing.length ? hintId : undefined}>
            {t(initial ? 'request.custom.submitEdit' : 'request.custom.submitAdd')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
