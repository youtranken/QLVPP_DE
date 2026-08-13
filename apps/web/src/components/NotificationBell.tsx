import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { Badge, Button, Dropdown, Empty, Flex, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { routes } from '../App';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../lib/queries';
import { formatDateTime } from '../lib/format';

/** Chuông thông báo trong app (NOTIF-1/2) — số chưa đọc + mở đúng đơn khi bấm. */
export function NotificationBell() {
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  const panel = (
    <div
      style={{
        width: 'min(360px, calc(100vw - 24px))',
        background: 'var(--ant-color-bg-elevated, #fff)',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,.12)',
        overflow: 'hidden',
      }}
    >
      <Flex align="center" justify="space-between" style={{ padding: '8px 12px' }}>
        <Typography.Text strong>Thông báo</Typography.Text>
        <Button
          type="link"
          size="small"
          icon={<CheckOutlined />}
          disabled={unread === 0}
          loading={markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          Đọc tất cả
        </Button>
      </Flex>

      {items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="Chưa có thông báo"
          style={{ padding: 16 }}
        />
      ) : (
        <Flex vertical style={{ maxHeight: 400, overflowY: 'auto' }}>
          {items.map((item) => (
            <Flex
              key={item.id}
              vertical
              gap={2}
              style={{
                cursor: 'pointer',
                padding: '8px 12px',
                borderTop: '1px solid rgba(0,0,0,.06)',
                background: item.readAt ? undefined : 'rgba(29,104,181,.06)',
              }}
              onClick={() => {
                if (!item.readAt) markRead.mutate(item.id);
                if (item.requestId) navigate(routes.myRequests);
              }}
            >
              <Typography.Text strong={!item.readAt}>{item.title}</Typography.Text>
              {item.body && <Typography.Text type="secondary">{item.body}</Typography.Text>}
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {formatDateTime(item.createdAt)}
              </Typography.Text>
            </Flex>
          ))}
        </Flex>
      )}
    </div>
  );

  return (
    <Dropdown popupRender={() => panel} trigger={['click']} placement="bottomRight">
      <Button type="text" aria-label="Thông báo">
        <Badge count={unread} size="small">
          <BellOutlined style={{ fontSize: 18 }} />
        </Badge>
      </Button>
    </Dropdown>
  );
}
