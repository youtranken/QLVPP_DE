import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { vnStampParts } from '@/features/reports/print-format';
import { monthOf } from '@/features/request/request-format';

// Tờ phiếu luôn song ngữ theo mẫu D&E (như Excel sheet 1), không theo ngôn ngữ giao diện
const FORM_LANG = 'vi';
const COLUMNS = ['no', 'code', 'name', 'nameEn', 'unit', 'qty'] as const;
const BILINGUAL = new Set(['no', 'code', 'unit', 'qty']);

export interface PreviewRow {
  key: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  qty: number;
}

export interface PreviewBox {
  title: string;
  title_en: string;
  name: string;
}

interface Props {
  rows: PreviewRow[];
  signatureBoxes: PreviewBox[];
  ym: string;
}

function Head({ col }: { col: (typeof COLUMNS)[number] }) {
  const { t } = useTranslation();
  const label = (key: string) => t(`reports.print.form.col.${key}`, { lng: FORM_LANG });
  if (!BILINGUAL.has(col)) return <th scope="col">{label(col)}</th>;
  return (
    <th scope="col">
      {label(col)} {label(`${col}En`)}
    </th>
  );
}

export function RequestFormPreview({ rows, signatureBoxes, ym }: Props) {
  const { t } = useTranslation();
  const form = (key: string, opts: Record<string, unknown> = {}) => t(`reports.print.form.${key}`, { lng: FORM_LANG, ...opts });
  return (
    <section className="sa-preview" aria-label={t('sendAdm.preview.label', { month: monthOf(ym), year: ym.slice(0, 4) })}>
      <div className="sa-sheet">
        <header className="sa-sheet__head">
          <h2 className="sa-sheet__title">{form('title')}</h2>
          <p className="sa-sheet__sub">{form('subtitle')}</p>
          <p className="sa-sheet__date">{form('date', { date: vnStampParts(new Date().toISOString()).date })}</p>
        </header>
        <table className="sa-sheet__table">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <Head key={c} col={c} />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key}>
                <td className="n">{i + 1}</td>
                <td>{r.code || form('noCode')}</td>
                <td>{r.name}</td>
                <td>{r.name_en ?? ''}</td>
                <td>{r.unit}</td>
                <td className="n">{r.qty}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="sa-sheet__empty">{form('empty')}</td>
              </tr>
            )}
          </tbody>
        </table>
        <div role="group" aria-label={form('signGroup')} className="sa-signs">
          {signatureBoxes.map((box, i) => (
            <div key={i} role="group" aria-label={box.title} className="sa-sign">
              <b>{box.title}</b>
              {box.title_en && <span className="sa-sign__en">{box.title_en}</span>}
              <span className="sa-sign__space" aria-hidden="true" />
              {box.name ? <span>{box.name}</span> : <span className="sa-sign__blank" data-testid="sign-dots" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 210 mm theo px CSS (96 dpi)
const SHEET_PX = (210 * 96) / 25.4;

// Thu cả tờ bằng transform để bố cục 210 mm không reflow khi khung hẹp
function FitSheet({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const scale = w > 0 ? Math.min(1, w / SHEET_PX) : 1;
      setBox({ scale, height: (sheet.current?.offsetHeight ?? 0) * scale });
    };
    fit();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  return (
    <div ref={frame} className="sa-fit" style={box.height ? { height: box.height } : undefined}>
      <div ref={sheet} className="sa-fit__sheet" data-testid="sheet-fit" style={{ width: '210mm', transform: `scale(${box.scale})` }}>
        {children}
      </div>
    </div>
  );
}

export function PreviewButton(props: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}>
        {t('sendAdm.preview.open')}
      </button>
      {open && (
        <Dialog open onOpenChange={setOpen} maxWidth={920} className="sheet sa-preview-dialog">
          <div className="sheet-header">
            <DialogTitle className="sheet-title">{t('sendAdm.preview.open')}</DialogTitle>
            <DialogCloseButton />
          </div>
          <div className="sheet-body">
            <FitSheet>
              <RequestFormPreview {...props} />
            </FitSheet>
          </div>
        </Dialog>
      )}
    </>
  );
}
