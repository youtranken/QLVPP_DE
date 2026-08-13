import { DeleteOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { MAX_ITEM_QTY } from '@vpp/shared';
import { App, Button, Card, Flex, Image, Input, InputNumber, Typography } from 'antd';
import { useRef } from 'react';
import { ApiError, api } from '../../lib/api';

/** Một dòng người dùng tự nhập cho nhóm "Khác". */
export interface OtherLine {
  key: string;
  name: string;
  unit: string;
  quantity: number;
  attachmentPath: string | null;
  uploading?: boolean;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

interface Props {
  lines: OtherLine[];
  onChange: (lines: OtherLine[]) => void;
  disabled: boolean;
}

/**
 * Mục "Khác" (CORE-3): tự nhập tên + đơn vị + số lượng, kèm ảnh minh hoạ.
 * Ảnh upload NGAY khi chọn để lấy đường dẫn; đơn chỉ giữ đường dẫn đó.
 */
export function OtherItemsCard({ lines, onChange, disabled }: Props) {
  const { message } = App.useApp();
  const fileInputs = useRef(new Map<string, HTMLInputElement | null>());

  const update = (key: string, patch: Partial<OtherLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const addLine = () =>
    onChange([
      ...lines,
      {
        key: `other-${Date.now()}-${lines.length}`,
        name: '',
        unit: '',
        quantity: 1,
        attachmentPath: null,
      },
    ]);

  const pickFile = async (key: string, file: File) => {
    // Kiểm ngay ở trình duyệt để báo lỗi sớm; server vẫn kiểm lại.
    if (!file.type.startsWith('image/')) {
      message.error('Chỉ nhận tệp ảnh.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      message.error('Ảnh vượt quá 5MB.');
      return;
    }

    update(key, { uploading: true });
    try {
      const result = await api.upload<{ path: string }>('/uploads', file);
      update(key, { attachmentPath: result.path, uploading: false });
    } catch (error) {
      update(key, { uploading: false });
      message.error(error instanceof ApiError ? error.displayMessage : 'Tải ảnh thất bại.');
    }
  };

  return (
    <Card
      title="Món ngoài danh mục"
      extra={
        <Button icon={<PlusOutlined />} onClick={addLine} disabled={disabled}>
          Thêm dòng
        </Button>
      }
    >
      {lines.length === 0 ? (
        <Typography.Text type="secondary">
          Cần món không có trong danh mục? Bấm “Thêm dòng” để tự nhập và đính ảnh minh hoạ.
        </Typography.Text>
      ) : (
        <Flex vertical gap={12}>
          {lines.map((line) => (
            <Flex key={line.key} gap={8} wrap align="flex-start">
              <Input
                style={{ flex: '2 1 200px' }}
                placeholder="Tên món"
                value={line.name}
                disabled={disabled}
                onChange={(event) => update(line.key, { name: event.target.value })}
              />
              <Input
                style={{ flex: '1 1 100px' }}
                placeholder="Đơn vị (cái, hộp…)"
                value={line.unit}
                disabled={disabled}
                onChange={(event) => update(line.key, { unit: event.target.value })}
              />
              <InputNumber
                min={1}
                max={MAX_ITEM_QTY}
                value={line.quantity}
                disabled={disabled}
                onChange={(value) => update(line.key, { quantity: value ?? 1 })}
              />

              <input
                type="file"
                accept="image/*"
                hidden
                ref={(element) => {
                  fileInputs.current.set(line.key, element);
                }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void pickFile(line.key, file);
                  event.target.value = '';
                }}
              />
              <Button
                icon={<UploadOutlined />}
                loading={line.uploading}
                disabled={disabled}
                onClick={() => fileInputs.current.get(line.key)?.click()}
              >
                {line.attachmentPath ? 'Đổi ảnh' : 'Ảnh'}
              </Button>
              {line.attachmentPath && (
                <Image
                  src={line.attachmentPath}
                  width={32}
                  height={32}
                  style={{ objectFit: 'cover' }}
                />
              )}

              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={disabled}
                onClick={() => onChange(lines.filter((other) => other.key !== line.key))}
              />
            </Flex>
          ))}
        </Flex>
      )}
    </Card>
  );
}
