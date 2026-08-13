import { PlusCircleOutlined, RightOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Row,
  Skeleton,
  Tag,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { routes } from '../App';
import { periodLabel, STATUS_META } from '../lib/format';
import { useMe, useMyRequests, useRegistrationStatus } from '../lib/queries';

/** Trang chủ nhân viên: kỳ hiện tại, trạng thái đăng ký, tóm tắt đơn (SDD §8 màn 1). */
export function HomePage() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: status, isPending: statusPending } = useRegistrationStatus();
  const { data: requests, isPending: requestsPending } = useMyRequests(status?.period);

  if (statusPending || requestsPending) return <Skeleton active />;

  /** Đơn đang hiệu lực của kỳ này — đơn bị từ chối/huỷ chỉ còn là lịch sử. */
  const current = requests?.find((request) =>
    ['submitted', 'approved', 'delivered'].includes(request.status),
  );
  const rejected = requests?.filter((request) => request.status === 'rejected') ?? [];

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Xin chào, {me?.name ?? me?.email}
      </Typography.Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title={`Kỳ ${periodLabel(status?.period ?? '')}`}>
            {current ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Mã đơn">{current.code}</Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <Tag color={STATUS_META[current.status].color}>
                    {STATUS_META[current.status].label}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Số món">{current.items.length}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Bạn chưa đăng ký cho kỳ này"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} md={12}>
          <Card title="Việc cần làm">
            <Flex vertical gap={12} align="flex-start">
              {rejected.length > 0 && (
                <Alert
                  type="error"
                  showIcon
                  style={{ width: '100%' }}
                  title="Đơn của bạn bị từ chối"
                  description={
                    <>
                      Lý do: {rejected[0].rejectReason ?? '—'}
                      <br />
                      Bạn có thể gửi lại đơn mới trong kỳ này.
                    </>
                  }
                />
              )}

              {current ? (
                <Button icon={<RightOutlined />} onClick={() => navigate(routes.myRequests)}>
                  Xem đơn của tôi
                </Button>
              ) : (
                <>
                  <Button
                    type="primary"
                    icon={<PlusCircleOutlined />}
                    disabled={!status?.canRegister}
                    onClick={() => navigate(routes.register)}
                  >
                    Đăng ký VPP
                  </Button>
                  {!status?.canRegister && (
                    <Typography.Text type="secondary">
                      Hiện đã đóng đăng ký. Vui lòng quay lại từ ngày {status?.windowStartDay} đến
                      ngày {status?.windowEndDay} tháng sau.
                    </Typography.Text>
                  )}
                </>
              )}
            </Flex>
          </Card>
        </Col>
      </Row>
    </Flex>
  );
}
