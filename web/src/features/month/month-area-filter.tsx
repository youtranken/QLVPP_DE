import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogClose, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';

interface Props {
  options: string[];
  value: readonly string[];
  onChange: (next: string[]) => void;
}

// G1: lọc nhiều khu (phòng); không chọn khu nào = mọi khu
export function MonthAreaFilter({ options, value, onChange }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<string[] | null>(null);
  const toggle = (area: string) => setDraft((d) => (d!.includes(area) ? d!.filter((x) => x !== area) : [...d!, area]));
  const apply = () => {
    onChange(options.filter((o) => draft!.includes(o)));
    setDraft(null);
  };
  return (
    <div className="mk-areas" role="group" aria-label={t('month.area.label')}>
      {value.map((area) => (
        <span key={area} className="chip mk-area">
          {area}
          <button type="button" className="mk-area__x" aria-label={t('month.area.remove', { name: area })} onClick={() => onChange(value.filter((x) => x !== area))}>
            <Icon name="x" size={14} />
          </button>
        </span>
      ))}
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => setDraft([...value])}>
        {t('month.area.add')}
      </button>
      {draft && (
        <Dialog open onOpenChange={(o) => !o && setDraft(null)} className="sheet" maxWidth={400}>
          <div className="sheet-header">
            <DialogTitle className="sheet-title">{t('month.area.title')}</DialogTitle>
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
    </div>
  );
}
