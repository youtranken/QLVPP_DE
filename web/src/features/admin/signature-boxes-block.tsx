import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { MAX_SIGN_BOXES } from '@/features/reports/print-format';
import { SignBoxes } from '@/features/reports/print-request-form';
import { BOXES_MAX, boxLabel, newBox, type BoxDraft } from './config-form';
import { ConfigSection } from './config-section';
import type { ConfigBlockState } from './use-config-block';
import '@/features/reports/print.m1.css';

type BoxField = 'title' | 'title_en' | 'name';
const FIELDS: { key: BoxField; label: string; max: number; required?: boolean; hint?: string }[] = [
  { key: 'title', label: 'config.signers.titleVi', max: 60, required: true },
  { key: 'title_en', label: 'config.signers.titleEn', max: 60 },
  { key: 'name', label: 'config.signers.name', max: 200, hint: 'config.signers.nameHint' },
];

// Phiếu chỉ in 2 ô đầu: Cấu hình không cho thêm quá số ô in được; cấu hình cũ có ô thứ 3 vẫn hiện (mờ) để sửa hoặc xóa
const ADD_LIMIT = Math.min(MAX_SIGN_BOXES, BOXES_MAX);

export function SignatureBoxesBlock({ state }: { state: ConfigBlockState<BoxDraft[]> }) {
  const { t, i18n } = useTranslation();
  const fullId = useId();
  const { draft, errors, update } = state;
  const setField = (i: number, key: BoxField, value: string) =>
    update((boxes) => boxes.map((b, j) => (j === i ? { ...b, [key]: value } : b)), `signature_boxes.${i}.${key}`);
  // Xóa/thêm làm lệch chỉ số hàng nên bỏ hết lỗi ô cũ
  const reshape = (next: (boxes: BoxDraft[]) => BoxDraft[]) => update(next, 'all');
  const full = draft.length >= ADD_LIMIT;

  return (
    <ConfigSection title={t('config.signers.title')} description={t('config.signers.hint')} saveLabel={t('config.signers.save')} state={state}>
      {draft.map((box, i) => {
        const title = boxLabel(box, i18n.language).trim();
        const named = title ? t('config.signers.boxNamed', { n: i + 1, title }) : t('config.signers.box', { n: i + 1 });
        const off = i >= MAX_SIGN_BOXES;
        return (
          <fieldset key={box.id} className={off ? 'cf-box cf-box--off' : 'cf-box'}>
            <legend>
              {named}
              {off && <span className="cf-box__off">{t('config.signers.notPrinted', { n: MAX_SIGN_BOXES })}</span>}
            </legend>
            {FIELDS.map((f) => {
              const err = errors[`signature_boxes.${i}.${f.key}`];
              return (
                <FormField key={f.key} label={t(f.label)} required={f.required} hint={f.hint ? t(f.hint) : undefined} error={err ? t(err) : undefined}>
                  {(p) => <input {...p} maxLength={f.max} value={box[f.key]} onChange={(e) => setField(i, f.key, e.target.value)} />}
                </FormField>
              );
            })}
            {draft.length > 1 && (
              <button
                type="button"
                className="btn btn--danger-line btn--sm cf-box__remove"
                aria-label={title ? t('config.signers.removeNamed', { n: i + 1, title }) : t('config.signers.removeN', { n: i + 1 })}
                onClick={() => reshape((boxes) => boxes.filter((b) => b.id !== box.id))}
              >
                {t('config.signers.remove')}
              </button>
            )}
          </fieldset>
        );
      })}
      <div className="cf-box__add-row">
        <button
          type="button"
          className="btn cf-box__add"
          disabled={full}
          aria-describedby={full ? fullId : undefined}
          onClick={() => reshape((boxes) => [...boxes, newBox()])}
        >
          {t('config.signers.add')}
        </button>
        {full && (
          <span id={fullId} className="cf-box__full">
            {t('config.signers.full', { n: MAX_SIGN_BOXES })}
          </span>
        )}
      </div>
      <SignaturePreview boxes={draft} />
    </ConfigSection>
  );
}

// Đúng component ô ký của tờ in (chức danh song ngữ cố định theo mẫu D&E), chỉ các ô sẽ in
function SignaturePreview({ boxes }: { boxes: BoxDraft[] }) {
  const { t } = useTranslation();
  const labelId = useId();
  const printed = boxes.slice(0, MAX_SIGN_BOXES).map((b) => ({ title: b.title.trim(), title_en: b.title_en.trim(), name: b.name.trim() }));
  return (
    <section className="cf-sign-preview" aria-labelledby={labelId}>
      <p id={labelId} className="cf-sign-preview__label">
        {t('config.signers.preview')}
      </p>
      <div className="cf-sign-preview__paper">
        <SignBoxes boxes={printed} />
      </div>
    </section>
  );
}
