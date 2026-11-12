import type { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { AccountContent } from '@/features/profile/account-content';
import { usePopover } from '@/lib/use-popover';
import { Dialog, DialogCloseButton, DialogDescription, DialogTitle } from '@/ui/dialog';

export interface AccountTrigger {
  ref: RefObject<HTMLButtonElement | null>;
  'aria-expanded': boolean;
  'aria-controls': string | undefined;
  'aria-haspopup': 'dialog';
  onClick: () => void;
}

type Props =
  | { variant: 'popover'; open: boolean; onOpenChange: (open: boolean) => void; trigger: (p: AccountTrigger) => ReactNode }
  | { variant: 'sheet'; open: boolean; onOpenChange: (open: boolean) => void; trigger?: undefined };

function Popover({ open, onOpenChange, trigger }: Extract<Props, { variant: 'popover' }>) {
  const { t } = useTranslation();
  const pop = usePopover({ open, onOpenChange });
  return (
    <div ref={pop.box} className="acct-wrap" onKeyDown={pop.onKeyDown}>
      {trigger({
        ref: pop.trigger,
        'aria-expanded': open,
        'aria-controls': open ? pop.id : undefined,
        'aria-haspopup': 'dialog',
        onClick: () => pop.setOpen((v) => !v),
      })}
      {open && (
        <div ref={pop.panel} id={pop.id} role="dialog" aria-label={t('profile.menu')} className="acct-pop">
          <AccountContent />
        </div>
      )}
    </div>
  );
}

export function AccountMenu(props: Props) {
  const { t } = useTranslation();
  if (props.variant === 'popover') return <Popover {...props} />;
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      className="sheet sheet--bottom acct-sheet"
      overlayClassName="modal-backdrop rq-sheet-backdrop"
      viewportClassName="rq-sheet-viewport"
    >
      <div className="acct-sheet__head">
        <DialogTitle asChild>
          <h2>{t('profile.menu')}</h2>
        </DialogTitle>
        <DialogCloseButton />
      </div>
      <DialogDescription className="sr-only">{t('profile.menu')}</DialogDescription>
      <AccountContent language />
    </Dialog>
  );
}
