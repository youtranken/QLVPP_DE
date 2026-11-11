import { useLayoutEffect } from 'react';

// Layout effect, không phải effect: CSS app nằm dưới [data-shell], gắn sau lần vẽ đầu là nháy giao diện trần khi tải lại (body vì dialog portal ra đó)
export function useShellFont(shell: 'member' | 'admin'): void {
  useLayoutEffect(() => {
    document.body.dataset.shell = shell;
  }, [shell]);
}
