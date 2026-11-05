import { useTranslation } from 'react-i18next';
import { useUnitNames } from '@/features/units/units.api';
import { ItemThumb } from '@/ui/item-thumb';
import type { Tone } from '@/lib/group-tone';
import type { ItemDraft } from './item-draft';

// Thẻ thu nhỏ giống thẻ món ở trang Đăng ký của nhân viên, đọc thẳng từ nháp của form
export function StaffPreview({ draft, tone }: { draft: ItemDraft; tone: Tone }) {
  const { t, i18n } = useTranslation();
  const unitName = useUnitNames();
  const en = i18n.language === 'en' && draft.name_en.trim() !== '';
  const name = (en ? draft.name_en : draft.name).trim() || t('catalog.staffPreview.namePlaceholder');
  const max = Number(draft.max_qty);
  const unit = draft.unit ? unitName(draft.unit) : t('common.empty');
  return (
    <section className="ct-preview" aria-label={t('catalog.staffPreview.title')}>
      <h3 className="ct-preview__title">{t('catalog.staffPreview.title')}</h3>
      <div className="ct-preview__card">
        <ItemThumb fileId={draft.image_file_id} alt="" tone={tone} size="card" />
        <div className="ct-preview__name">
          {name}
          {draft.pack_note.trim() && <span className="ct-preview__pack"> · {draft.pack_note.trim()}</span>}
        </div>
        <div className="ct-preview__unit">{t('request.grid.unitMax', { unit, max: Number.isFinite(max) && draft.max_qty !== '' ? max : t('common.empty') })}</div>
      </div>
    </section>
  );
}
