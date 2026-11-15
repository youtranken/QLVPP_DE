import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/navigate", () => ({ navigateTo: vi.fn(), submitForm: vi.fn() }));

import { apiFetch, queryClient } from "@/lib/api-client";
import { loginWithPmhId, logout } from "@/lib/auth-actions";
import { navigateTo, submitForm } from "@/lib/navigate";
import {
  endLogout,
  handleSessionExpired,
  rememberAuth,
  takeReturnTo,
} from "@/lib/session-relogin";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(navigateTo).mockClear();
  vi.mocked(submitForm).mockClear();
  queryClient.clear();
  endLogout();
  window.sessionStorage.clear();
});

// Nút Đăng xuất = thoát trình duyệt này khỏi Tài khoản D&E: form POST điều hướng cả trang, server 303 sang PMH ID — JS không thấy id_token
describe("logout", () => {
  it("phiên SSO → gửi form POST /api/auth/logout (csrf + ui_locales), không fetch, quên trạng thái đăng nhập", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    rememberAuth("sso");
    logout("csrf-1", "u-member");
    expect(submitForm).toHaveBeenCalledWith("/api/auth/logout", {
      csrf: "csrf-1",
      ui_locales: "vi",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(navigateTo).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("vpp.auth.mode")).toBeNull();
  });

  it("phiên SA cục bộ → thêm local=1 (phiên đã mất cũng không đẩy sang PMH ID); không có csrf → gửi rỗng", () => {
    rememberAuth("sa");
    logout(null, "u-member");
    expect(submitForm).toHaveBeenCalledWith("/api/auth/logout", {
      csrf: "",
      ui_locales: "vi",
      local: "1",
    });
  });

  it("sub local:sa (tab mới, chưa nhớ chế độ) cũng là phiên cục bộ", () => {
    logout("c", "local:sa");
    expect(submitForm).toHaveBeenCalledWith("/api/auth/logout", {
      csrf: "c",
      ui_locales: "vi",
      local: "1",
    });
  });
});

describe("logout: 401 muộn không kéo sang trang hết phiên / SSO lại", () => {
  it("truy vấn đang bay trả 401 SAU khi bấm đăng xuất → không gọi luồng hết phiên", async () => {
    rememberAuth("sso");
    let late: (r: Response) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((res) => {
            late = res;
          }),
      ),
    );
    const inflight = apiFetch(
      "/api/me/notifications?unread=true&limit=1",
    ).catch((e: unknown) => e);
    logout("csrf", "u-member");
    late(new Response(null, { status: 401 }));
    await inflight;
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it("chưa bấm đăng xuất: 401 vẫn đi luồng hết phiên", () => {
    handleSessionExpired();
    expect(navigateTo).toHaveBeenCalledWith("/?session=expired");
  });
});

// Mở link sâu khi chưa đăng nhập → bấm Đăng nhập → callback về '/' → phải về lại trang đã mở
describe("loginWithPmhId nhớ trang đang mở", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("đang ở /admin/stock?tab=issues → returnTo = /admin/stock?tab=issues", () => {
    window.history.replaceState(null, "", "/admin/stock?tab=issues");
    loginWithPmhId("a@pmh.com.vn");
    expect(takeReturnTo()).toBe("/admin/stock?tab=issues");
  });

  it("đang ở / → không lưu returnTo", () => {
    loginWithPmhId("a@pmh.com.vn");
    expect(takeReturnTo()).toBeNull();
  });

  it("đang ở /?session=expired → không lưu (trang đầu kèm thông báo, không phải trang nghiệp vụ)", () => {
    window.history.replaceState(null, "", "/?session=expired");
    loginWithPmhId();
    expect(takeReturnTo()).toBeNull();
  });
});
