import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/shell/app-routes';
import { MeContext, type Me } from '@/lib/me';
import { renderWithI18n } from '@/test/test-utils';
import { ConfirmProvider } from '@/ui/confirm-provider';

function LocationProbe() {
  const { pathname, search } = useLocation();
  return (
    <>
      <output data-testid="location">{pathname}</output>
      <output data-testid="location-search">{search}</output>
    </>
  );
}

export function renderApp(me: Me, path: string) {
  return renderWithI18n(
    <MeContext.Provider value={me}>
      <MemoryRouter initialEntries={[path]}>
        <ConfirmProvider>
          <AppRoutes />
          <LocationProbe />
        </ConfirmProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
}
