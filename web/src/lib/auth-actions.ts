import { queryClient } from "@/lib/api-client";
import { currentLanguage } from "@/lib/lang-pref";
import { navigateTo, submitForm } from "@/lib/navigate";
import {
  authMode,
  beginLogout,
  forgetAuth,
  rememberAuth,
  rememberReturnTo,
  ssoLoginUrl,
  switchAccountUrl,
} from "@/lib/session-relogin";

export function loginWithPmhId(loginHint?: string): void {
  const { pathname, search, hash } = window.location;
  rememberReturnTo(pathname + search + hash);
  navigateTo(ssoLoginUrl(loginHint));
}

export type SaLoginOutcome = "ok" | "invalid" | "locked" | "error";

export type IdentifyOutcome = "password" | "invalid" | "locked" | "error";

// Chữ không phải email: chỉ server biết tên tài khoản nội bộ (SA) — web không giữ, public-config không trả
export async function identifyLogin(
  identifier: string,
): Promise<IdentifyOutcome> {
  try {
    const res = await fetch("/api/auth/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: identifier.trim() }),
    });
    if (res.status === 429) return "locked";
    if (!res.ok) return "error";
    const body = (await res.json()) as { next?: unknown };
    return body.next === "password" || body.next === "invalid"
      ? body.next
      : "error";
  } catch {
    return "error";
  }
}

// Đăng nhập không qua SSO (SA, tài khoản thử dev): mode 'sa' = hết phiên thì về màn đăng nhập, không tự SSO lại
async function postLocalLogin(
  url: string,
  username: string,
  password: string,
): Promise<SaLoginOutcome> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    if (res.ok) {
      rememberAuth("sa");
      return "ok";
    }
    if (res.status === 429) return "locked";
    if (res.status === 401) return "invalid";
    return "error";
  } catch {
    return "error";
  }
}

export function saLogin(
  username: string,
  password: string,
): Promise<SaLoginOutcome> {
  return postLocalLogin("/api/auth/sa-login", username, password);
}

// Tài khoản thử — chỉ bản dev (api trả 404 khi tắt)
export function testAccountLogin(
  username: string,
  password: string,
): Promise<SaLoginOutcome> {
  return postLocalLogin("/api/auth/test-login", username, password);
}

// Đăng xuất trình duyệt này khỏi Tài khoản D&E và mọi app (máy khác giữ phiên): form POST điều hướng cả trang, server xóa phiên app rồi 303 sang /oidc/logout —
// id_token không xuống JS. Phiên SA cục bộ gửi local=1: phiên đã mất cũng chỉ về trang đầu
export function logout(csrfToken: string | null, sub: string): void {
  // 401 của truy vấn đang bay (fetch không hủy được) không được kéo sang trang hết phiên / SSO lại
  beginLogout();
  void queryClient.cancelQueries();
  const local = isLocalSession(sub);
  forgetAuth();
  submitForm("/api/auth/logout", {
    csrf: csrfToken ?? "",
    ui_locales: currentLanguage(),
    ...(local ? { local: "1" } : {}),
  });
}

function isLocalSession(sub: string): boolean {
  return sub === "local:sa" || authMode() === "sa";
}

// Bị chặn quyền: phải qua end_session của PMH ID, nếu không phiên SSO còn sống sẽ lặp lại forbidden
export function switchAccount(): void {
  forgetAuth();
  navigateTo(switchAccountUrl());
}
