import { useId, type ReactNode } from 'react';

export function useDisabledReason(reason: string | null): { describedBy?: string; node: ReactNode } {
  const id = useId();
  if (!reason) return { node: null };
  return {
    describedBy: id,
    node: (
      <small id={id} className="disabled-reason">
        {reason}
      </small>
    ),
  };
}
