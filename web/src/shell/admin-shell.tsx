import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ADMIN_PHONE_QUERY, useMediaQuery } from "@/lib/use-media-query";
import { IconSprite } from "@/ui/icon-sprite";
import { Loading, NoPermission } from "@/ui/load-state";
import { RouteChunk } from "@/ui/chunk-error-boundary";
import { ToastProvider } from "@/ui/toast-provider";
import { AdminSidebar } from "@/shell/admin-sidebar";
import { AdminTopbar } from "@/shell/admin-topbar";
import { AdminHeader } from "@/shell/admin-header";
import { useForbiddenRole } from "@/shell/use-forbidden-role";
import { useLockTimer } from "@/features/request/use-lock-timer";
import { useShellFont } from "@/shell/use-shell-font";
import { useNumberWheelGuard } from "@/lib/use-number-wheel-guard";

export function AdminShell() {
  const { t } = useTranslation();
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  const forbidden = useForbiddenRole();
  useShellFont("admin");
  useNumberWheelGuard();
  useLockTimer();

  return (
    <ToastProvider>
      <IconSprite />
      <div className="shell">
        <a className="skip-link" href="#main">
          {t("common.skipToContent")}
        </a>
        {phone ? <AdminTopbar /> : <AdminSidebar />}
        <div className="shell__col">
          {!phone && <AdminHeader />}
          <main id="main" className="shell__main" tabIndex={-1}>
            <div className="shell__panel">
              {forbidden ? (
                <NoPermission />
              ) : (
                <RouteChunk loading={<Loading />}>
                  <Outlet />
                </RouteChunk>
              )}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
