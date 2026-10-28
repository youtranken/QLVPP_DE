import { BrowserRouter } from 'react-router-dom';
import { MeContext } from '@/lib/me';
import { SSO_LOGIN_URL } from '@/lib/session-relogin';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { EntryError, EntryLoading, SsoRedirecting } from '@/shell/entry-states';
import { LoginScreen } from '@/shell/login-screen';
import { AppRoutes } from '@/shell/app-routes';
import { useAuthBoot } from '@/shell/use-auth-boot';

export default function App() {
  const auth = useAuthBoot();

  if (auth.kind === 'loading') return <EntryLoading />;
  if (auth.kind === 'error') return <EntryError onRetry={() => window.location.reload()} />;
  if (auth.kind === 'redirecting') return <SsoRedirecting href={SSO_LOGIN_URL} />;
  if (auth.kind === 'anonymous') return <LoginScreen sessionExpired={auth.expired} ssoDown={auth.ssoDown} />;

  return (
    <MeContext.Provider value={auth.me}>
      <BrowserRouter>
        <ConfirmProvider>
          <AppRoutes />
        </ConfirmProvider>
      </BrowserRouter>
    </MeContext.Provider>
  );
}
