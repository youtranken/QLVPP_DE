import { useLayoutEffect } from 'react';

// Dialog portal ra body nên font theo shell phải đặt ở body, không chỉ ở khung shell.
// Gần như mọi luật CSS của app nằm dưới [data-shell='…'], nên thuộc tính phải có TRƯỚC lần vẽ đầu:
// useEffect chạy sau khi trình duyệt vẽ → lúc tải lại trang thấy ô nhập và chữ trần dồn góc trái rồi mới có giao diện.
export function useShellFont(shell: 'member' | 'admin'): void {
  useLayoutEffect(() => {
    document.body.dataset.shell = shell;
  }, [shell]);
}
