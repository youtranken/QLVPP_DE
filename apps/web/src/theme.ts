import type { ThemeConfig } from 'antd';

/**
 * Theme **trung tính đặt chỗ** (SDD §8): dùng tới khi có tên + logo + màu thương
 * hiệu chính thức. Khi có rồi chỉ cần đổi `colorPrimary` và logo ở AppLayout.
 */
export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#1d68b5',
    fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    borderRadius: 8,
  },
  components: {
    Layout: { headerHeight: 56 },
  },
};
