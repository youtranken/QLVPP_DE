import { useEffect } from 'react';

// Dialog portal ra body nên font theo shell phải đặt ở body, không chỉ ở khung shell
export function useShellFont(shell: 'member' | 'admin'): void {
  useEffect(() => {
    document.body.dataset.shell = shell;
  }, [shell]);
}
