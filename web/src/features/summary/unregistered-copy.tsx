import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import { useUnregisteredCopy } from './use-unregistered-copy';

interface UnregisteredCopyProps {
  ym: string;
  deadline: string | null;
  count: number;
}

export function UnregisteredCopy({ ym, deadline, count }: UnregisteredCopyProps) {
  const { t } = useTranslation();
  const hintId = useId();
  const c = useUnregisteredCopy(ym, deadline);
  return (
    <span className="sm-copy">
      <button
        type="button"
        className="btn"
        disabled={c.busy || count === 0}
        aria-describedby={count === 0 ? hintId : undefined}
        onClick={c.copy}
      >
        <Icon name="copy" size={18} />
        {t('summary.unregistered.copy.button', { n: count })}
      </button>
      {count === 0 && (
        <span id={hintId} className="sm-note">
          {t('summary.unregistered.allDone')}
        </span>
      )}
      {c.feedback}
    </span>
  );
}
