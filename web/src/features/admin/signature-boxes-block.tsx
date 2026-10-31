import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { BOXES_MAX, boxLabel, newBox, type BoxDraft } from './config-form';
import { ConfigSection } from './config-section';
import type { ConfigBlockState } from './use-config-block';

type BoxField = 'title' | 'title_en' | 'name';
const FIELDS: { key: BoxField; label: string; max: number; required?: boolean; hint?: string }[] = [
  { key: 'title', label: 'config.signers.titleVi', max: 60, required: true },
  { key: 'title_en', label: 'config.signers.titleEn', max: 60 },
  { key: 'name', label: 'config.signers.name', max: 200, hint: 'config.signers.nameHint' },
];

export function SignatureBoxesBlock({ state }: { state: ConfigBlockState<BoxDraft[]> }) {
  const { t, i18n } = useTranslation();
  const { draft, errors, update } = state;
  const setField = (i: number, key: BoxField, value: string) =>
    update((boxes) => boxes.map((b, j) => (j === i ? { ...b, [key]: value } : b)), `signature_boxes.${i}.${key}`);
  // Xóa/thêm làm lệch chỉ số hàng nên bỏ hết lỗi ô cũ
  const reshape = (next: (boxes: BoxDraft[]) => BoxDraft[]) => update(next, 'all');

  return (
    <ConfigSection title={t('config.signers.title')} description={t('config.signers.hint')} saveLabel={t('config.signers.save')} state={state}>
      {draft.map((box, i) => {
        const title = boxLabel(box, i18n.language).trim();
        return (
          <fieldset key={box.id} className="cf-box">
            <legend>{title ? t('config.signers.boxNamed', { n: i + 1, title }) : t('config.signers.box', { n: i + 1 })}</legend>
            {FIELDS.map((f) => {
              const err = errors[`signature_boxes.${i}.${f.key}`];
              return (
                <FormField key={f.key} label={t(f.label)} required={f.required} hint={f.hint ? t(f.hint) : undefined} error={err ? t(err) : undefined}>
                  {(p) => <input {...p} maxLength={f.max} value={box[f.key]} onChange={(e) => setField(i, f.key, e.target.value)} />}
                </FormField>
              );
            })}
            {draft.length > 1 && (
              <button type="button" className="btn btn--ghost btn--sm cf-box__remove" onClick={() => reshape((boxes) => boxes.filter((b) => b.id !== box.id))}>
                {t('config.signers.remove')}
              </button>
            )}
          </fieldset>
        );
      })}
      {draft.length < BOXES_MAX && (
        <button type="button" className="btn cf-box__add" onClick={() => reshape((boxes) => [...boxes, newBox()])}>
          {t('config.signers.add')}
        </button>
      )}
      <SignaturePreview boxes={draft} language={i18n.language} />
    </ConfigSection>
  );
}

function SignaturePreview({ boxes, language }: { boxes: BoxDraft[]; language: string }) {
  const { t } = useTranslation();
  return (
    <table className="cf-sign-preview" aria-label={t('config.signers.preview')}>
      <thead>
        <tr>
          {boxes.map((b) => (
            <th key={b.id} scope="col">
              {boxLabel(b, language)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          {boxes.map((b) => (
            <td key={b.id}>{b.name.trim() || '……………………'}</td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
