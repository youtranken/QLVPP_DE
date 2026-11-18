import type { KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { discardOptions, useOptionalConfirm } from '@/ui/confirm-context';
import { Dialog, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';
import { useDirtyBackGuard } from '@/lib/use-panel-param';

export interface PanelNav {
  index: number;
  total: number;
  onStep: (dir: 1 | -1) => void;
  prevLabel: string;
  nextLabel: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  // Thay khối tiêu đề mặc định (DialogTitle nằm trong head); ‹ › và đóng vẫn do panel vẽ cùng hàng
  head?: ReactNode;
  dirty?: boolean;
  saving?: boolean;
  nav?: PanelNav;
  footer?: ReactNode;
  // Dòng phụ nhỏ trên tiêu đề (kỳ · tổ…)
  eyebrow?: string;
  onCloseFocus?: () => boolean;
  // Form sửa món/nhóm: ngăn rộng 560 để form hai cột không chật
  wide?: boolean;
  children: ReactNode;
}

const PLACEMENT = 'end';
const TYPING = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"]';

function stepOf(e: KeyboardEvent<HTMLElement>): 1 | -1 | null {
  if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return null;
  if (e.target instanceof Element && e.target.closest(TYPING)) return null;
  const key = e.key.toLowerCase();
  if (key === 'arrowdown' || key === 'j') return 1;
  if (key === 'arrowup' || key === 'k') return -1;
  return null;
}

function NavButtons({ nav, can, onStep, showPos = true }: { nav: PanelNav; can: (dir: 1 | -1) => boolean; onStep: (dir: 1 | -1) => void; showPos?: boolean }) {
  const { t } = useTranslation();
  const at = nav.index >= 0 ? String(nav.index + 1) : '—';
  return (
    <>
      {showPos && <span className="ovp-pos num">{t('common.panel.position', { i: at, n: nav.total })}</span>}
      <button type="button" className="btn btn--ghost btn--sm ovp-icon" aria-label={nav.prevLabel} disabled={!can(-1)} onClick={() => onStep(-1)}>
        <Icon name="chevup" size={18} />
      </button>
      <button type="button" className="btn btn--ghost btn--sm ovp-icon" aria-label={nav.nextLabel} disabled={!can(1)} onClick={() => onStep(1)}>
        <Icon name="chev" size={18} />
      </button>
    </>
  );
}

export function OverlayPanel({ open, onClose, title, head, dirty = false, saving = false, nav, footer, eyebrow, onCloseFocus, wide = false, children }: Props) {
  const { t } = useTranslation();
  const askConfirm = useOptionalConfirm();
  const ask = () => (askConfirm ? askConfirm(discardOptions(t)) : Promise.resolve(true));
  const guarded = (go: () => void) => {
    if (!dirty) return go();
    void ask().then((ok) => ok && go());
  };
  useDirtyBackGuard(open && dirty, ask);
  const can = (dir: 1 | -1) => !!nav && !saving && nav.index >= 0 && nav.index + dir >= 0 && nav.index + dir < nav.total;
  const onStep = (dir: 1 | -1) => can(dir) && guarded(() => nav!.onStep(dir));
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = stepOf(e);
    if (dir === null || !can(dir)) return;
    e.preventDefault();
    onStep(dir);
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && guarded(onClose)}
      dismissible={!saving}
      className={wide ? 'ovp ovp--wide' : 'ovp'}
      placement={PLACEMENT}
      overlayClassName="ovp-backdrop"
      viewportClassName="ovp-viewport"
      onKeyDown={onKeyDown}
      onCloseFocus={onCloseFocus}
    >
      <div className={head ? 'ovp-head ovp-head--rich' : 'ovp-head'}>
        {head ?? (
          <div className="ovp-titles">
            {eyebrow && <small className="ovp-eyebrow">{eyebrow}</small>}
            <DialogTitle className="ovp-title">{title}</DialogTitle>
          </div>
        )}
        {nav && <NavButtons nav={nav} can={can} onStep={onStep} showPos={!head} />}
        <DialogCloseButton disabled={saving} />
      </div>
      <div className="ovp-body">{children}</div>
      {footer && <div className="ovp-foot">{footer}</div>}
    </Dialog>
  );
}
