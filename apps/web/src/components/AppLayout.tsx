import {
  AuditOutlined,
  DashboardOutlined,
  FileTextOutlined,
  HomeOutlined,
  LogoutOutlined,
  PlusCircleOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Dropdown, Flex, Layout, Menu, Tag, Typography, type MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../App';
import { api } from '../lib/api';
import { periodLabel } from '../lib/format';
import { useMe, useRegistrationStatus } from '../lib/queries';
import { NotificationBell } from './NotificationBell';

/**
 * Khung app: menu theo vai trò, chuông thông báo, đăng xuất đúng phạm vi và
 * banner trạng thái cửa sổ đăng ký (SDD §8).
 * Menu nằm ngang và tự thu gọn nhãn trên màn nhỏ (NFR-1).
 */
export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { data: status } = useRegistrationStatus();
  const navigate = useNavigate();
  const location = useLocation();

  const laAdmin = me?.role === 'admin';

  /**
   * Menu theo vai trò.
   *
   * **Admin** mở app là để điều hành, nên Bảng điều khiển và Duyệt đơn nằm THẲNG
   * trên thanh menu — hai việc làm hằng ngày không nên nằm sau một lần bấm mở
   * menu con. Trang chủ bỏ khỏi menu admin vì Bảng điều khiển đã thay đúng vai trò
   * đó. Menu "Quản trị" còn lại là những việc thỉnh thoảng mới đụng (danh mục,
   * danh bạ, cài đặt…).
   *
   * **Nhân viên** giữ nguyên Trang chủ làm điểm xuất phát.
   *
   * Ẩn menu chỉ là lớp trải nghiệm; backend mới thực sự chặn quyền (SDD §2).
   */
  const menuItems: MenuProps['items'] = laAdmin
    ? [
        { key: routes.adminDashboard, icon: <DashboardOutlined />, label: t('nav.dashboard') },
        { key: routes.adminRequests, icon: <AuditOutlined />, label: t('nav.adminRequests') },
        { key: routes.register, icon: <PlusCircleOutlined />, label: t('nav.register') },
        { key: routes.myRequests, icon: <FileTextOutlined />, label: t('nav.myRequests') },
        {
          key: 'admin',
          icon: <SettingOutlined />,
          label: t('nav.admin'),
          children: [
            { key: routes.adminSummary, label: t('nav.summary') },
            { key: routes.adminHandover, label: t('nav.handover') },
            { key: routes.adminCatalog, label: t('nav.catalog') },
            { key: routes.adminDirectory, label: t('nav.directory') },
            { key: routes.adminAudit, label: t('nav.audit') },
            { key: routes.adminSettings, label: t('nav.settings') },
          ],
        },
      ]
    : [
        { key: routes.home, icon: <HomeOutlined />, label: t('nav.home') },
        { key: routes.register, icon: <PlusCircleOutlined />, label: t('nav.register') },
        { key: routes.myRequests, icon: <FileTextOutlined />, label: t('nav.myRequests') },
      ];

  /** Đăng xuất local: chỉ huỷ phiên app, không đụng phiên SSO (AUTH-2 AC1). */
  const signOutLocal = async () => {
    await api.post('/auth/logout');
    window.location.assign(routes.signIn);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingInline: 12,
          background: '#fff',
          borderBottom: '1px solid rgba(0,0,0,.06)',
        }}
      >
        {/* Chỗ đặt logo khi có tài sản thương hiệu ([⏳] SDD §12). */}
        <Typography.Text strong style={{ whiteSpace: 'nowrap' }}>
          DE-VPP
        </Typography.Text>

        <Menu
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
        />

        <NotificationBell />

        <Dropdown
          menu={{
            items: [
              {
                key: 'profile',
                disabled: true,
                label: (
                  <Flex vertical>
                    <Typography.Text strong>{me?.name ?? me?.email}</Typography.Text>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {me?.department ?? '—'} · {me?.role === 'admin' ? 'Quản trị' : 'Nhân viên'}
                    </Typography.Text>
                  </Flex>
                ),
              },
              { type: 'divider' },
              { key: 'local', icon: <LogoutOutlined />, label: t('auth.signOutLocal') },
              { key: 'global', icon: <LogoutOutlined />, label: t('auth.signOutGlobal') },
            ],
            onClick: ({ key }) => {
              if (key === 'local') void signOutLocal();
              // Đăng xuất toàn hệ là điều hướng RỜI app sang IdP.
              if (key === 'global') window.location.assign('/api/auth/logout-global');
            },
          }}
        >
          <Flex align="center" gap={6} style={{ cursor: 'pointer' }}>
            <UserOutlined />
            <Typography.Text style={{ maxWidth: 140 }} ellipsis>
              {me?.name ?? me?.email ?? ''}
            </Typography.Text>
          </Flex>
        </Dropdown>
      </Layout.Header>

      <Layout.Content>
        <div className="vpp-page">
          {status && (
            <Alert
              style={{ marginBottom: 16 }}
              type={status.open ? 'success' : 'warning'}
              showIcon
              title={
                <Flex gap={8} wrap align="center">
                  <span>
                    {status.open ? t('period.open') : t('period.closed')} —{' '}
                    <strong>{periodLabel(status.period)}</strong>
                  </span>
                  <Tag>{t('period.windowHint', { window: status.windowLabel })}</Tag>
                </Flex>
              }
              description={
                !status.open && status.canRegister ? t('period.adminOverride') : undefined
              }
            />
          )}
          {children}
        </div>
      </Layout.Content>
    </Layout>
  );
}
