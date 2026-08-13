import { CheckOutlined, CloseOutlined, EditOutlined, UndoOutlined } from '@ant-design/icons';
import { canDeliverRequest } from '@vpp/shared';
import {
  Alert,
  App,
  Button,
  Checkbox,
  Descriptions,
  Drawer,
  Flex,
  Image,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useState } from 'react';
import { ApiError } from '../../lib/api';
import {
  useApproveRequest,
  useDeliverAll,
  useDeliverLine,
  useRejectRequest,
  type AdminRequest,
} from '../../lib/admin-queries';
import { formatDateTime, periodLabel, STATUS_META } from '../../lib/format';
import type { RequestLine } from '../../lib/types';
import { AdjustRequestModal } from './AdjustRequestModal';

/**
 * Chi tiết đơn cho quản trị viên: duyệt / từ chối / xác nhận giao / điều chỉnh
 * (CORE-11…15). Gom vào một ngăn kéo để admin xử lý xong một đơn rồi mới sang đơn
 * khác, thay vì nhảy qua lại nhiều màn.
 */
export function RequestDetailDrawer({
  request,
  open,
  onClose,
}: {
  request: AdminRequest | null;
  open: boolean;
  onClose: () => void;
}) {
  const { message } = App.useApp();
  const approve = useApproveRequest();
  const reject = useRejectRequest();
  const deliverLine = useDeliverLine();
  const deliverAll = useDeliverAll();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);

  if (!request) return null;

  const meta = STATUS_META[request.status];
  const canReview = request.status === 'submitted';
  const canDeliver = canDeliverRequest(request.status);

  /** Lỗi hay gặp nhất ở đây là "trạng thái đã đổi" do admin khác vừa thao tác. */
  const run = async (action: () => Promise<unknown>, successText: string) => {
    try {
      await action();
      message.success(successText);
    } catch (error) {
      message.error(error instanceof ApiError ? error.displayMessage : 'Thao tác thất bại.');
    }
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      message.warning('Phải nhập lý do từ chối.');
      return;
    }
    await run(
      () => reject.mutateAsync({ id: request.id, reason: rejectReason.trim() }),
      'Đã từ chối đơn',
    );
    setRejectOpen(false);
    setRejectReason('');
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={720}
      title={
        <Flex align="center" gap={8} wrap>
          <span>{request.code}</span>
          <Tag color={meta.color}>{meta.label}</Tag>
        </Flex>
      }
      extra={
        <Space wrap>
          {canReview && (
            <>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={approve.isPending}
                onClick={() =>
                  void run(() => approve.mutateAsync(request.id), 'Đã duyệt đơn').then(onClose)
                }
              >
                Duyệt
              </Button>
              <Button danger icon={<CloseOutlined />} onClick={() => setRejectOpen(true)}>
                Từ chối
              </Button>
            </>
          )}
          {canDeliver && (
            <>
              <Button
                icon={<CheckOutlined />}
                loading={deliverAll.isPending}
                onClick={() =>
                  void run(
                    () => deliverAll.mutateAsync({ id: request.id, delivered: true }),
                    'Đã đánh dấu giao toàn bộ',
                  )
                }
              >
                Giao tất cả
              </Button>
              <Button
                icon={<UndoOutlined />}
                onClick={() =>
                  void run(
                    () => deliverAll.mutateAsync({ id: request.id, delivered: false }),
                    'Đã hoàn tác',
                  )
                }
              >
                Hoàn tác
              </Button>
            </>
          )}
          <Button icon={<EditOutlined />} onClick={() => setAdjustOpen(true)}>
            Điều chỉnh
          </Button>
        </Space>
      }
    >
      <Flex vertical gap={16}>
        {request.status === 'rejected' && (
          <Alert type="error" showIcon title="Đã từ chối" description={request.rejectReason} />
        )}

        <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
          <Descriptions.Item label="Người đăng ký">
            {request.userName ?? request.userEmail ?? '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Phòng ban">{request.departmentName ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Kỳ">{periodLabel(request.period)}</Descriptions.Item>
          <Descriptions.Item label="Gửi lúc">{formatDateTime(request.createdAt)}</Descriptions.Item>
          {request.approvedAt && (
            <Descriptions.Item label="Duyệt lúc">
              {formatDateTime(request.approvedAt)}
            </Descriptions.Item>
          )}
          {request.deliveredAt && (
            <Descriptions.Item label="Giao đủ lúc">
              {formatDateTime(request.deliveredAt)}
            </Descriptions.Item>
          )}
          {request.note && <Descriptions.Item label="Ghi chú">{request.note}</Descriptions.Item>}
        </Descriptions>

        <div className="vpp-scroll-x">
          <Table<RequestLine>
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 520 }}
            dataSource={request.items}
            columns={[
              {
                title: 'Món',
                dataIndex: 'name',
                minWidth: 220,
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
                width: 120,
                align: 'center',
                render: (_, line) => (
                  <Checkbox
                    checked={line.delivered}
                    // Chỉ đơn đã duyệt mới được tick giao (BR-09).
                    disabled={!canDeliver || deliverLine.isPending}
                    onChange={(event) =>
                      void run(
                        () =>
                          deliverLine.mutateAsync({
                            id: request.id,
                            lineId: line.id,
                            delivered: event.target.checked,
                          }),
                        event.target.checked ? 'Đã đánh dấu giao' : 'Đã bỏ đánh dấu',
                      )
                    }
                  >
                    {line.delivered ? line.deliveredQty : ''}
                  </Checkbox>
                ),
              },
            ]}
          />
        </div>

        {!canDeliver && request.status === 'submitted' && (
          <Typography.Text type="secondary">
            Đơn phải được duyệt trước khi xác nhận giao.
          </Typography.Text>
        )}
      </Flex>

      <Modal
        open={rejectOpen}
        title={`Từ chối đơn ${request.code}`}
        okText="Từ chối"
        cancelText="Đóng"
        okButtonProps={{ danger: true, loading: reject.isPending }}
        onOk={() => void confirmReject()}
        onCancel={() => setRejectOpen(false)}
      >
        <Typography.Paragraph type="secondary">
          Lý do sẽ hiện cho nhân viên để họ sửa và gửi lại đơn mới trong kỳ.
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          autoFocus
          maxLength={500}
          placeholder="Lý do từ chối (bắt buộc)"
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
        />
      </Modal>

      <AdjustRequestModal
        request={request}
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onDone={() => setAdjustOpen(false)}
      />
    </Drawer>
  );
}
