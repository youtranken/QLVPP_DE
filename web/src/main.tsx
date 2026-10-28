import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@/css/tokens.css';
import '@/css/base.css';
import '@/css/member.css';
import '@/css/admin.css';
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
