import {
  FileTextOutlined,
  HomeOutlined,
  LogoutOutlined,
  PlusCircleOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Dropdown, Flex, Layout, Menu, Tag, Typography } from 'antd';
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

  const menuItems = [
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
                  <Tag>
                    {t('period.windowHint', {
                      start: status.windowStartDay,
                      end: status.windowEndDay,
                    })}
                  </Tag>
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
