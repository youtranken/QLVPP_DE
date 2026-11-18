import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogClose, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';

interface Props {
  options: string[];
  value: readonly string[];
  onChange: (next: string[]) => void;
}

// Ô chọn nhiều phòng; không chọn phòng nào = mọi phòng. Phòng đang lọc gỡ từng cái ở hàng "Đang lọc"
export function MonthAreaFilter({ options, value, onChange }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string[] | null>(null);
  const toggle = (area: string) => setDraft((d) => (d!.includes(area) ? d!.filter((x) => x !== area) : [...d!, area]));
  const apply = () => {
    onChange(options.filter((o) => draft!.includes(o)));
    setDraft(null);
  };
  return (
    <>
      <button type="button" className="btn mk-area-btn" data-on={value.length > 0 || undefined} onClick={() => setDraft([...value])}>
        <Icon name="filter" size={16} />
        <span className="mk-area-btn__text">{value.length ? t('month.area.buttonWith', { names: value.join(', ') }) : t('month.area.button')}</span>
        <Icon name="chev" size={16} />
      </button>
      {draft && (
        <Dialog open onOpenChange={(o) => !o && setDraft(null)} className="sheet" maxWidth={400}>
          <div className="sheet-header">
            <DialogTitle className="sheet-title">{t('month.area.button')}</DialogTitle>
            <DialogCloseButton />
          </div>
          <div className="sheet-body mk-area-list">
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft([...options])}>
              {t('month.area.all')}
            </button>
            {options.map((area) => (
              <label key={area} className="mk-area-opt">
                <input type="checkbox" checked={draft.includes(area)} onChange={() => toggle(area)} />
                <span>{area}</span>
              </label>
            ))}
          </div>
          <div className="sheet-footer">
            <DialogClose asChild>
              <button type="button" className="btn btn--ghost">
                {t('month.area.cancel')}
              </button>
            </DialogClose>
            <button type="button" className="btn btn--primary" onClick={apply}>
              {t('month.area.apply')}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
