import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { MAX_ITEM_QTY } from '@vpp/shared';
import { Button, Card, Flex, Input, InputNumber, Typography } from 'antd';
import { ImagePicker } from '../../components/ImagePicker';

/** Một dòng người dùng tự nhập cho nhóm "Khác". */
export interface OtherLine {
  key: string;
  name: string;
  unit: string;
  quantity: number;
  attachmentPath: string | null;
}

interface Props {
  lines: OtherLine[];
  onChange: (lines: OtherLine[]) => void;
  disabled: boolean;
}

/**
 * Mục "Khác" (CORE-3): tự nhập tên + đơn vị + số lượng, kèm ảnh minh hoạ.
 * Phần chọn ảnh dùng chung `ImagePicker` với màn quản lý danh mục.
 */
export function OtherItemsCard({ lines, onChange, disabled }: Props) {
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
        <Flex vertical gap={16}>
          {lines.map((line) => (
            <Flex key={line.key} gap={8} wrap align="center">
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
                aria-label={`Số lượng ${line.name || 'món ngoài danh mục'}`}
                onChange={(value) => update(line.key, { quantity: value ?? 1 })}
              />

              <ImagePicker
                size={44}
                label="Ảnh"
                disabled={disabled}
                value={line.attachmentPath}
                onChange={(path) => update(line.key, { attachmentPath: path })}
              />

              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={disabled}
                aria-label={`Bỏ dòng ${line.name || 'món ngoài danh mục'}`}
                onClick={() => onChange(lines.filter((other) => other.key !== line.key))}
              />
            </Flex>
          ))}
        </Flex>
      )}
    </Card>
  );
}
