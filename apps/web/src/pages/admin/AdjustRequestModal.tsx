import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { MAX_ITEM_QTY } from '@vpp/shared';
import { Alert, App, Button, Flex, Input, InputNumber, Modal, Select, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { useAdjustRequest, type AdminRequest } from '../../lib/admin-queries';
import { useCatalog } from '../../lib/queries';

interface EditableLine {
  key: string;
  itemId: string | null;
  name: string;
  unit: string;
  quantity: number;
}

/**
 * Điều chỉnh đặc biệt (CORE-13): admin sửa số lượng, thêm hoặc bớt món — **kể cả
 * giấy A4** — và không bị khoá bởi cửa sổ đăng ký. Mọi thay đổi được ghi audit
 * kèm danh sách dòng trước/sau.
 */
export function AdjustRequestModal({
  request,
  open,
  onClose,
  onDone,
}: {
  request: AdminRequest;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const { message } = App.useApp();
  const { data: catalog } = useCatalog();
  const adjust = useAdjustRequest();
  const [lines, setLines] = useState<EditableLine[]>([]);
  const [reason, setReason] = useState('');

  // Nạp lại mỗi lần mở để không giữ bản nháp cũ của đơn khác.
  useEffect(() => {
    if (!open) return;
    setLines(
      request.items.map((item) => ({
        key: item.id,
        itemId: item.itemId,
        name: item.name,
        unit: item.unit,
        quantity: item.quantity,
      })),
    );
    setReason('');
  }, [open, request]);

  const itemOptions = (catalog ?? [])
    .flatMap((group) => group.items)
    .map((item) => ({
      value: item.id,
      label: `${item.name}${item.adminOnly ? ' (chỉ admin)' : ''}`,
      unit: item.unit,
      name: item.name,
    }));

  const update = (key: string, patch: Partial<EditableLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const submit = async () => {
    if (lines.length === 0) {
      message.warning('Đơn phải còn ít nhất một món.');
      return;
    }
    try {
      await adjust.mutateAsync({
        id: request.id,
        reason: reason.trim() || undefined,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          name: line.name,
          unit: line.unit,
          quantity: line.quantity,
        })),
      });
      message.success('Đã điều chỉnh đơn');
      onDone();
    } catch (error) {
      message.error(error instanceof ApiError ? error.displayMessage : 'Điều chỉnh thất bại.');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={() => void submit()}
      okText="Lưu điều chỉnh"
      cancelText="Đóng"
      width={720}
      title={`Điều chỉnh đơn ${request.code}`}
      okButtonProps={{ loading: adjust.isPending }}
    >
      <Flex vertical gap={12}>
        <Alert
          type="info"
          showIcon
          title="Thao tác của quản trị viên"
          description="Được thêm cả món chỉ dành cho admin và không bị khoá bởi khung ngày đăng ký. Thay đổi sẽ được ghi vào nhật ký."
        />

        {request.status === 'delivered' && (
          <Alert
            type="warning"
            showIcon
            title="Đơn đang ở trạng thái đã giao"
            description="Sửa dòng sẽ đưa đơn về trạng thái “đã duyệt” để xác nhận giao lại."
          />
        )}

        {lines.map((line) => (
          <Flex key={line.key} gap={8} wrap align="center">
            {line.itemId ? (
              <Select
                showSearch
                optionFilterProp="label"
                style={{ flex: '2 1 260px' }}
                value={line.itemId}
                options={itemOptions}
                onChange={(value) => {
                  const picked = itemOptions.find((option) => option.value === value);
                  update(line.key, {
                    itemId: value,
                    name: picked?.name ?? '',
                    unit: picked?.unit ?? '',
                  });
                }}
              />
            ) : (
              <>
                <Input
                  style={{ flex: '2 1 180px' }}
                  value={line.name}
                  placeholder="Tên món"
                  onChange={(event) => update(line.key, { name: event.target.value })}
                />
                <Input
                  style={{ flex: '0 1 110px' }}
                  value={line.unit}
                  placeholder="Đơn vị"
                  onChange={(event) => update(line.key, { unit: event.target.value })}
                />
              </>
            )}

            <InputNumber
              min={1}
              max={MAX_ITEM_QTY}
              value={line.quantity}
              onChange={(value) => update(line.key, { quantity: value ?? 1 })}
              aria-label={`Số lượng ${line.name}`}
            />
            <Button
              danger
              icon={<DeleteOutlined />}
              aria-label={`Bỏ dòng ${line.name}`}
              onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
            />
          </Flex>
        ))}

        <Flex gap={8} wrap>
          <Button
            icon={<PlusOutlined />}
            onClick={() =>
              setLines((current) => [
                ...current,
                {
                  key: `new-${Date.now()}`,
                  itemId: itemOptions[0]?.value ?? null,
                  name: itemOptions[0]?.name ?? '',
                  unit: itemOptions[0]?.unit ?? '',
                  quantity: 1,
                },
              ])
            }
          >
            Thêm món từ danh mục
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() =>
              setLines((current) => [
                ...current,
                { key: `other-${Date.now()}`, itemId: null, name: '', unit: '', quantity: 1 },
              ])
            }
          >
            Thêm món tự nhập
          </Button>
        </Flex>

        <Typography.Text type="secondary">Lý do điều chỉnh (ghi vào nhật ký)</Typography.Text>
        <Input.TextArea
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Ví dụ: bổ sung theo đề nghị của trưởng phòng"
        />
      </Flex>
    </Modal>
  );
}
