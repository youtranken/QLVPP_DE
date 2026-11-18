import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import '@/css/fonts.css';
import '@/css/tokens.css';
import '@/css/tokens-m1.css';
import '@/css/base.css';
import '@/css/login.css';
import '@/css/admin.css';
import '@/features/notifications/notifications.css';
import '@/css/m1/base.css';
import '@/css/m1/shell.css';
import '@/css/m1/quick-search.css';
import '@/css/m1/states.css';
import '@/css/m1/table.css';
import '@/css/grid-table.m1.css';
import '@/css/m1/filter.css';
import '@/ui/filter/scroll-fade.css';
import '@/css/m1/list-page.css';
import '@/css/m1/overlay.css';
import '@/css/m1/row-menu.css';
import '@/css/m1/member-shell.css';
import '@/css/m1/member-page.css';
import '@/css/m1/stamp.css';
import '@/css/fields.css';
import '@/css/focus.css';
// CSS của các màn (kể cả màn nạp lười) gom về đây, đúng thứ tự cũ: cả app vẫn một file CSS, thứ tự quy tắc y như
// trước khi tách chunk (không lệch cascade), và đổi trang không phải chờ CSS (không chớp trơn). Thêm CSS mới cho màn
// thì thêm dòng ở đây (test main-css-order.test.ts nhắc).
import '@/features/profile/profile.m1.css';
import '@/features/request/filter-bar.m1.css';
import '@/ui/paused-stamp.css';
import '@/features/request/item-card.m1.css';
import '@/features/summary/adjust-dialog.m1.css';
import '@/features/request/request.m1.css';
import '@/features/request/history.m1.css';
import '@/features/catalog/catalog-filter.m1.css';
import '@/features/catalog/catalog.m1.css';
import '@/features/catalog/categories.m1.css';
import '@/features/catalog/setup.m1.css';
import '@/features/units/units.m1.css';
import '@/features/directory/user-picker.css';
import '@/features/stock/stock.m1.css';
import '@/features/directory/directory.m1.css';
import '@/features/admin/audit.m1.css';
import '@/features/reports/print.m1.css';
import '@/features/admin/config.m1.css';
import '@/features/review/review.m1.css';
import '@/features/summary/summary.m1.css';
import '@/features/month/month.m1.css';
import '@/features/arrivals/arrivals.m1.css';
import '@/features/delivery/people/delivery-people.m1.css';
import '@/features/delivery/delivery.m1.css';
import '@/features/delivery/backlog.m1.css';
import '@/features/today/today.m1.css';
import '@/features/send-adm/send-adm.m1.css';
import '@/features/reports/reports.m1.css';
// Trình nghe popstate chung của panel phải đăng ký trước khi BrowserRouter mount (màn dùng nó nằm ở chunk lười)
import '@/lib/use-panel-param';
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
