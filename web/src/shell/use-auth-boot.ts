import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { apiErrorCode } from '@/lib/api-error';
import { applySignedInLanguage } from '@/lib/i18n';
import type { Me } from '@/lib/me';
import { cameFromPortal } from '@/lib/pmh-portal';
import { navigateTo } from '@/lib/navigate';
import {
  authMode,
  forgetAuth,
  isRedirecting,
  rememberAuth,
  shouldAutoRelogin,
  ssoLoginUrl,
  startRelogin,
  takeReturnTo,
} from '@/lib/session-relogin';

export type AuthState =
  | { kind: 'loading' }
  | { kind: 'anonymous'; expired: boolean; ssoDown?: boolean }
  | { kind: 'redirecting' }
  | { kind: 'authenticated'; me: Me }
  | { kind: 'error' };

function onAuthenticated(me: Me): AuthState {
  // Phiên SA không bao giờ tự SSO lại
  rememberAuth(me.role === 'sa' ? 'sa' : 'sso');
  // Vừa SSO lại (callback về '/') → trả về trang cũ trước khi router đọc URL
  const returnTo = takeReturnTo();
  if (returnTo && window.location.pathname === '/' && !window.location.search) {
    window.history.replaceState(null, '', returnTo);
  }
  return { kind: 'authenticated', me };
}

function onUnauthenticated(): AuthState | null {
  // StrictMode chạy effect 2 lần — lần đầu đã quyết định chuyển hướng
  if (isRedirecting()) return null;
  const q = new URLSearchParams(window.location.search);
  const login = q.get('login');
  const wasSso = authMode() === 'sso';
  if (login === 'failed' || login === 'forbidden') {
    // Callback lỗi (kể cả lần tự SSO lại) → dừng hẳn tự SSO để không lặp
    forgetAuth();
    return { kind: 'anonymous', expired: wasSso && login === 'failed' };
  }
  if (shouldAutoRelogin()) {
    startRelogin();
    return { kind: 'redirecting' };
  }
  if (cameFromPortal()) {
    navigateTo(ssoLoginUrl());
    return { kind: 'redirecting' };
  }
  const expired = q.get('session') === 'expired' || authMode() !== null;
  forgetAuth();
  return { kind: 'anonymous', expired };
}

// PMH ID sập mà còn phiên SSO: "Thử lại" vô ích — phải mở được lối SA break-glass
async function isSsoUnavailable(res: Response): Promise<boolean> {
  if (res.status !== 503) return false;
  const body: unknown = await res.json().catch(() => null);
  return apiErrorCode(new ApiError(res.status, body)) === 'SSO_UNAVAILABLE';
}

export function useAuthBoot(): AuthState {
  const [state, setState] = useState<AuthState>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (res): Promise<AuthState | null> => {
        if (res.ok) {
          const me = (await res.json()) as Me;
          // Ngôn ngữ theo tài khoản PMH ID trước khi vẽ app (không nháy ngôn ngữ cũ)
          await applySignedInLanguage(me, { serverDate: res.headers?.get('date') });
          return onAuthenticated(me);
        }
        if (res.status === 401) return onUnauthenticated();
        if (await isSsoUnavailable(res)) return { kind: 'anonymous', expired: false, ssoDown: true };
        return { kind: 'error' };
      })
      .catch((): AuthState => ({ kind: 'error' }))
      .then((next) => {
        if (next && !cancelled) setState(next);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
