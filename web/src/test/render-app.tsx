import { MemoryRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from '@/shell/app-routes';
import { MeContext, type Me } from '@/lib/me';
import { renderWithI18n } from '@/test/test-utils';

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="location">{pathname}</output>;
}

export function renderApp(me: Me, path: string) {
  return renderWithI18n(
    <MeContext.Provider value={me}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <LocationProbe />
      </MemoryRouter>
    </MeContext.Provider>,
  );
}
