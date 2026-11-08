import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@/css/tokens.css';
import '@/css/tokens-m1.css';
import '@/css/base.css';
import '@/css/login.css';
import '@/css/admin.css';
import '@/features/notifications/notifications.css';
import '@/css/m1/base.css';
import '@/css/m1/shell.css';
import '@/css/m1/states.css';
import '@/css/m1/table.css';
import '@/css/grid-table.m1.css';
import '@/css/m1/filter.css';
import '@/css/m1/list-page.css';
import '@/css/m1/overlay.css';
import '@/css/m1/row-menu.css';
import '@/css/m1/member-shell.css';
import '@/css/m1/member-page.css';
import '@/css/m1/stamp.css';
import '@/lib/i18n';
import App from '@/App.tsx';
import { queryClient } from '@/lib/api-client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
