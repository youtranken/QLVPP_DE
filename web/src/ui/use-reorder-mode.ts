import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { discardOptions, useConfirm } from '@/ui/confirm-context';

interface LocalOrder {
  dirty: boolean;
  revert: () => void;
  save: () => Promise<void>;
}

export function useReorderMode(order: LocalOrder) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [on, setOn] = useState(false);
  const cancel = async () => {
    if (order.dirty && !(await confirm(discardOptions(t)))) return;
    order.revert();
    setOn(false);
  };
  const save = async () => {
    await order.save();
    setOn(false);
  };
  return { on, start: () => setOn(true), cancel, save };
}
