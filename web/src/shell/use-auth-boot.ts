import { useEffect, useState } from 'react';
import type { Me } from '@/lib/me';
import { cameFromPortal } from '@/lib/pmh-portal';
import { navigateTo } from '@/lib/navigate';
import {
  SSO_LOGIN_URL,
  authMode,
  forgetAuth,
  isRedirecting,
  rememberAuth,
  shouldAutoRelogin,
  startRelogin,
  takeReturnTo,
} from '@/lib/session-relogin';

export type AuthState =
  | { kind: 'loading' }
  | { kind: 'anonymous'; expired: boolean }
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
    navigateTo(SSO_LOGIN_URL);
    return { kind: 'redirecting' };
  }
  const expired = q.get('session') === 'expired' || authMode() !== null;
  forgetAuth();
  return { kind: 'anonymous', expired };
}

export function useAuthBoot(): AuthState {
  const [state, setState] = useState<AuthState>({ kind: 'loading' });
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(async (res): Promise<AuthState | null> => {
        if (res.ok) return onAuthenticated((await res.json()) as Me);
        if (res.status === 401) return onUnauthenticated();
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
