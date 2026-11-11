import { useEffect, useState } from 'react';

function focusFirstOrderError() {
  const box = document.querySelector<HTMLInputElement>('.bc-table input[aria-invalid="true"]');
  if (!box) return false;
  box.scrollIntoView?.({ block: 'center' });
  box.focus();
  return true;
}

// Bấm chốt khi còn ô lỗi: đưa con trỏ về ô lỗi đầu tiên. Ô bị bộ lọc "Chỉ món có Tổng cần" ẩn → tắt lọc rồi mới focus;
// vẫn không thấy ô nào thì báo ở đầu trang, không im lặng
export function useFocusOrderError(filterOn: boolean, setFilterOn: (on: boolean) => void, errorCount: number) {
  const [afterShow, setAfterShow] = useState(false);
  const [lost, setLost] = useState(false);
  useEffect(() => {
    if (!afterShow) return;
    setAfterShow(false);
    setLost(!focusFirstOrderError());
  }, [afterShow]);
  const go = () => {
    if (focusFirstOrderError()) return setLost(false);
    if (filterOn) {
      setFilterOn(false);
      return setAfterShow(true);
    }
    setLost(true);
  };
  return { go, lost: lost && errorCount > 0 };
}
