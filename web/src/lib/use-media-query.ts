import { useCallback, useSyncExternalStore } from 'react';

export const NARROW_QUERY = '(max-width: 900px)';
// Trang Đăng ký màn vừa (có giỏ cột phải): thanh lọc chật, chip nhóm cuộn ngang
export const MEMBER_MID_QUERY = '(min-width: 901px) and (max-width: 1180px)';
export const ADMIN_PHONE_QUERY = '(max-width: 767px)';
export const ADMIN_TABLET_QUERY = '(min-width: 768px) and (max-width: 1279px)';
// Màn thấp (điện thoại 360×640): chân menu thu một hàng để còn chỗ cho các mục điều hướng
export const SHORT_SCREEN_QUERY = '(max-height: 700px)';

function mql(query: string): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
}

export function useMediaQuery(query: string): boolean {
  // subscribe ổn định theo query: hàm mới mỗi lần vẽ khiến React gỡ rồi nghe lại listener mỗi lần vẽ
  const subscribe = useCallback(
    (onChange: () => void) => {
      const m = mql(query);
      m?.addEventListener('change', onChange);
      return () => m?.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => mql(query)?.matches ?? false);
}
