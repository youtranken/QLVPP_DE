import { PlusCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Divider, Flex, Skeleton, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { routes } from '../App';
import { formatDateTime, periodLabel, STATUS_META } from '../lib/format';
import { useMe, useMyRequests, useRegistrationStatus } from '../lib/queries';
import type { VppRequest } from '../lib/types';

/** Vài kỳ gần nhất, gọn trong một dòng mỗi kỳ. */
function LichSuNgan({ requests }: { requests: VppRequest[] }) {
  if (requests.length === 0) return null;
  return (
    <Flex vertical gap={8}>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        Các kỳ gần đây
      </Typography.Text>
      {requests.slice(0, 4).map((request) => (
        <Flex key={request.id} justify="space-between" align="center" gap={8} wrap>
          <Flex gap={8} align="center" style={{ minWidth: 0 }}>
            <Typography.Text style={{ whiteSpace: 'nowrap' }}>
              {periodLabel(request.period)}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis style={{ fontSize: 12 }}>
              {request.code} · {request.items.length} món
            </Typography.Text>
          </Flex>
          <Tag color={STATUS_META[request.status].color} style={{ marginInlineEnd: 0 }}>
            {STATUS_META[request.status].label}
          </Tag>
        </Flex>
      ))}
    </Flex>
  );
}

/**
 * Trang chủ của NHÂN VIÊN: đúng một thẻ trả lời "kỳ này tôi xong chưa" + lịch sử
 * ngắn. Admin không vào đây — `/` đưa họ thẳng sang Bảng điều khiển, nơi có số
 * liệu điều hành và danh sách đăng ký của các phòng ban.
 */
export function HomePage() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: status, isPending: statusPending } = useRegistrationStatus();
  const { data: requests, isPending: requestsPending } = useMyRequests();

  if (statusPending || requestsPending) return <Skeleton active />;

  const trongKy = (requests ?? []).filter((request) => request.period === status?.period);
  /** Đơn đang hiệu lực của kỳ này — đơn bị từ chối/huỷ chỉ còn là lịch sử. */
  const current = trongKy.find((request) =>
    ['submitted', 'approved', 'delivered'].includes(request.status),
  );
  const rejected = trongKy.filter((request) => request.status === 'rejected');

  /** Thẻ đăng ký của CHÍNH MÌNH — thứ duy nhất nhân viên cần biết khi mở app. */
  const theCaNhan = (
    <Card size="small">
      <Flex justify="space-between" align="center" gap={12} wrap>
        <Flex vertical gap={2} style={{ minWidth: 0 }}>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            Đơn của bạn · kỳ {periodLabel(status?.period ?? '')}
          </Typography.Text>
          {current ? (
            <Flex gap={8} align="center" wrap>
              <Typography.Text strong>{current.code}</Typography.Text>
              <Tag color={STATUS_META[current.status].color} style={{ marginInlineEnd: 0 }}>
                {STATUS_META[current.status].label}
              </Tag>
              <Typography.Text type="secondary">{current.items.length} món</Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                gửi {formatDateTime(current.createdAt)}
              </Typography.Text>
            </Flex>
          ) : (
            <Typography.Text strong>Bạn chưa đăng ký cho kỳ này</Typography.Text>
          )}
        </Flex>

        {current ? (
          <Button icon={<RightOutlined />} onClick={() => navigate(routes.myRequests)}>
            Xem đơn của tôi
          </Button>
        ) : (
          <Flex vertical align="flex-end" gap={4}>
            <Button
              type="primary"
              icon={<PlusCircleOutlined />}
              disabled={!status?.canRegister}
              onClick={() => navigate(routes.register)}
            >
              Đăng ký VPP
            </Button>
            {!status?.canRegister && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Nhận đăng ký {status?.windowLabel} hằng tháng
              </Typography.Text>
            )}
          </Flex>
        )}
      </Flex>

      {requests && requests.length > 0 && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <LichSuNgan requests={requests} />
        </>
      )}
    </Card>
  );

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Xin chào, {me?.name ?? me?.email}
      </Typography.Title>

      {rejected.length > 0 && (
        <Alert
          type="error"
          showIcon
          title="Đơn của bạn bị từ chối"
          description={
            <>
              Lý do: {rejected[0].rejectReason ?? '—'}
              <br />
              Bạn có thể gửi lại đơn mới trong kỳ này.
            </>
          }
          action={
            <Button
              size="small"
              onClick={() =>
                navigate(routes.register, { state: { copyFromRequestId: rejected[0].id } })
              }
            >
              Sửa và gửi lại
            </Button>
          }
        />
      )}

      {theCaNhan}
    </Flex>
  );
}
