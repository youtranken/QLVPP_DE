import { useEffect } from 'react';

export const PAGE_RULE = '@page { size: A4 portrait; margin: 14mm 14mm 16mm; }';

// Khổ giấy chỉ có hiệu lực lúc in từ app: không để @page toàn cục ảnh hưởng in các trang khác
export function insertPageStyle(): HTMLStyleElement {
  const style = document.createElement('style');
  style.dataset.printPage = '';
  style.textContent = PAGE_RULE;
  document.head.append(style);
  return style;
}

export function usePageStyle() {
  useEffect(() => {
    const style = insertPageStyle();
    return () => style.remove();
  }, []);
}
