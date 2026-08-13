import { periodForDate } from '@vpp/shared';
import { periodLabel } from './lib/format';

export function App() {
  const period = periodForDate();
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>DE-VPP</h1>
      <p>Hệ thống đăng ký văn phòng phẩm — kỳ {periodLabel(period)}</p>
      <p>Khung dự án (M0) đã sẵn sàng.</p>
    </main>
  );
}
