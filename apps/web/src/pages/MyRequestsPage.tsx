import { PlusCircleOutlined, RedoOutlined } from '@ant-design/icons';
import { canCancelRequest } from '@vpp/shared';
import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Empty,
  Flex,
  Image,
  Popconfirm,
  Skeleton,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { routes } from '../App';
import { ApiError } from '../lib/api';
import { formatDateTime, periodLabel, STATUS_META } from '../lib/format';
import { useCancelRequest, useMyRequests, useRegistrationWindow } from '../lib/queries';
import type { RequestLine, VppRequest } from '../lib/types';

/**
 * Bảng dòng đơn. `scroll.x` để trên điện thoại bảng **cuộn ngang** thay vì bóp
 * chữ xuống nhiều dòng (NFR-1).
 */
function LinesTable({ items }: { items: RequestLine[] }) {
  return (
    <div className="vpp-scroll-x">
      <Table<RequestLine>
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 460 }}
        dataSource={items}
        columns={[
          {
            title: 'Món',
            dataIndex: 'name',
            minWidth: 200,
            render: (name: string, line) => (
              <Flex align="center" gap={8}>
                {line.attachmentPath && (
                  <Image
                    src={line.attachmentPath}
                    width={28}
                    height={28}
                    style={{ objectFit: 'cover' }}
                  />
                )}
                <span>{name}</span>
              </Flex>
            ),
          },
          { title: 'ĐVT', dataIndex: 'unit', width: 90 },
          { title: 'SL', dataIndex: 'quantity', width: 70, align: 'center' },
          {
            title: 'Đã giao',
            dataIndex: 'deliveredQty',
            width: 110,
            align: 'center',
            render: (qty: number, line) =>
              line.delivered ? (
                <Tag color="cyan">{qty}</Tag>
              ) : (
                <Typography.Text type="secondary">—</Typography.Text>
              ),
          },
        ]}
      />
    </div>
  );
}

/** Đơn của tôi: lịch sử theo kỳ, chi tiết, huỷ và gửi lại (CORE-8/9). */
export function MyRequestsPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { data: requests, isPending } = useMyRequests();
  // Khung ngày do admin đặt ⇒ chỉ máy chủ biết. Chưa có thì KHÔNG hiện nút huỷ.
  const cuaSo = useRegistrationWindow();
  const cancelRequest = useCancelRequest();

  if (isPending) return <Skeleton active />;

  if (!requests || requests.length === 0) {
    return (
      <Card>
        <Empty description="Bạn chưa có đơn đăng ký nào">
          <Button
            type="primary"
            icon={<PlusCircleOutlined />}
            onClick={() => navigate(routes.register)}
          >
            Đăng ký ngay
          </Button>
        </Empty>
      </Card>
    );
  }

  /** Gom theo kỳ để đọc như một cuốn lịch sử. */
  const byPeriod = new Map<string, VppRequest[]>();
  for (const request of requests) {
    const bucket = byPeriod.get(request.period);
    if (bucket) bucket.push(request);
    else byPeriod.set(request.period, [request]);
  }

  const cancel = async (request: VppRequest) => {
    try {
      await cancelRequest.mutateAsync(request.id);
      message.success(`Đã huỷ đơn ${request.code}`);
    } catch (error) {
      message.error(error instanceof ApiError ? error.displayMessage : 'Huỷ đơn thất bại.');
    }
  };

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Đơn của tôi
      </Typography.Title>

      {[...byPeriod.entries()].map(([period, periodRequests]) => (
        <Card key={period} title={`Kỳ ${periodLabel(period)}`} size="small">
          <Collapse
            accordion
            defaultActiveKey={periodRequests[0]?.id}
            items={periodRequests.map((request) => ({
              key: request.id,
              label: (
                <Flex align="center" gap={8} wrap>
                  <Typography.Text strong>{request.code}</Typography.Text>
                  <Tag color={STATUS_META[request.status].color}>
                    {STATUS_META[request.status].label}
                  </Tag>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    Gửi {formatDateTime(request.createdAt)}
                  </Typography.Text>
                </Flex>
              ),
              children: (
                <Flex vertical gap={12}>
                  {request.status === 'rejected' && (
                    <Alert
                      type="error"
                      showIcon
                      title="Đơn bị từ chối"
                      description={request.rejectReason ?? '—'}
                      action={
                        <Button
                          size="small"
                          icon={<RedoOutlined />}
                          // Mang theo id đơn để màn đăng ký lấy sẵn nội dung —
                          // bị từ chối vì một dòng thì không nên gõ lại cả đơn.
                          onClick={() =>
                            navigate(routes.register, {
                              state: { copyFromRequestId: request.id },
                            })
                          }
                        >
                          Sửa và gửi lại
                        </Button>
                      }
                    />
                  )}

                  {request.note && (
                    <Typography.Text type="secondary">Ghi chú: {request.note}</Typography.Text>
                  )}

                  <LinesTable items={request.items} />

                  <Flex gap={12} wrap align="center">
                    {request.approvedAt && (
                      <Typography.Text type="secondary">
                        Duyệt lúc {formatDateTime(request.approvedAt)}
                      </Typography.Text>
                    )}
                    {request.deliveredAt && (
                      <Typography.Text type="secondary">
                        Giao đủ lúc {formatDateTime(request.deliveredAt)}
                      </Typography.Text>
                    )}

                    {/* Nút huỷ chỉ hiện khi thực sự huỷ được — dùng đúng quy tắc
                        của backend nên không hiện nút rồi mới báo lỗi (CORE-8). */}
                    {cuaSo && canCancelRequest(request.status, cuaSo) && (
                      <Popconfirm
                        title="Huỷ đơn này?"
                        description="Sau khi huỷ, bạn có thể gửi đơn mới trong kỳ."
                        okText="Huỷ đơn"
                        cancelText="Không"
                        onConfirm={() => void cancel(request)}
                      >
                        <Button danger size="small" loading={cancelRequest.isPending}>
                          Huỷ đơn
                        </Button>
                      </Popconfirm>
                    )}
                  </Flex>
                </Flex>
              ),
            }))}
          />
        </Card>
      ))}
    </Flex>
  );
}
