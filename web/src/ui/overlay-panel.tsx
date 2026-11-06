import type { KeyboardEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { panelDiscardOptions, useOptionalConfirm } from '@/ui/confirm-context';
import { Dialog, DialogClose, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
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
  dirty?: boolean;
  saving?: boolean;
  nav?: PanelNav;
  footer?: ReactNode;
  children: ReactNode;
}

const TYPING = 'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="listbox"]';

function stepOf(e: KeyboardEvent<HTMLElement>): 1 | -1 | null {
  if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return null;
  if (e.target instanceof Element && e.target.closest(TYPING)) return null;
  const key = e.key.toLowerCase();
  if (key === 'arrowdown' || key === 'j') return 1;
  if (key === 'arrowup' || key === 'k') return -1;
  return null;
}

function NavButtons({ nav, can, onStep }: { nav: PanelNav; can: (dir: 1 | -1) => boolean; onStep: (dir: 1 | -1) => void }) {
  const { t } = useTranslation();
  const at = nav.index >= 0 ? String(nav.index + 1) : '—';
  return (
    <>
      <span className="ovp-pos num">{t('common.panel.position', { i: at, n: nav.total })}</span>
      <button type="button" className="btn btn--ghost btn--sm ovp-icon" aria-label={nav.prevLabel} disabled={!can(-1)} onClick={() => onStep(-1)}>
        <Icon name="chevup" size={18} />
      </button>
      <button type="button" className="btn btn--ghost btn--sm ovp-icon" aria-label={nav.nextLabel} disabled={!can(1)} onClick={() => onStep(1)}>
        <Icon name="chev" size={18} />
      </button>
    </>
  );
}

export function OverlayPanel({ open, onClose, title, dirty = false, saving = false, nav, footer, children }: Props) {
  const { t } = useTranslation();
  const askConfirm = useOptionalConfirm();
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  const ask = () => (askConfirm ? askConfirm(panelDiscardOptions(t)) : Promise.resolve(true));
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
      className="ovp"
      overlayClassName="ovp-backdrop"
      viewportClassName="ovp-viewport"
      onKeyDown={onKeyDown}
    >
      {phone && (
        <div className="ovp-bar">
          <DialogClose asChild>
            <button type="button" className="btn btn--ghost ovp-back" disabled={saving}>
              {t('common.panel.close')}
            </button>
          </DialogClose>
        </div>
      )}
      <div className="ovp-head">
        <DialogTitle className="ovp-title">{title}</DialogTitle>
        {nav && <NavButtons nav={nav} can={can} onStep={onStep} />}
        {!phone && <DialogCloseButton disabled={saving} />}
      </div>
      <div className="ovp-body">{children}</div>
      {footer && <div className="ovp-foot">{footer}</div>}
    </Dialog>
  );
}
