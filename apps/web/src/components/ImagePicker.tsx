import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { App, Button, Flex, Image, Typography } from 'antd';
import { useRef, useState } from 'react';
import { ApiError, api } from '../lib/api';

/** Ảnh đính kèm tối đa 5MB (SDD §9) — kiểm ở đây để báo lỗi sớm; server vẫn kiểm lại. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Chọn / đổi / gỡ một ảnh. Tải lên NGAY khi chọn để lấy đường dẫn; nơi gọi chỉ
 * giữ đường dẫn đó. Dùng chung cho ảnh minh hoạ món (admin) và ảnh mục "Khác".
 *
 * `value`/`onChange` để optional theo đúng giao ước của `Form.Item` AntD — đặt
 * trong Form thì Form tự tiêm hai props này, không phải truyền tay.
 */
export function ImagePicker({
  value = null,
  onChange,
  disabled = false,
  size = 64,
  label = 'Chọn ảnh',
}: {
  value?: string | null;
  onChange?: (path: string | null) => void;
  disabled?: boolean;
  size?: number;
  label?: string;
}) {
  const { message } = App.useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Chỉ nhận tệp ảnh.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      message.error('Ảnh vượt quá 5MB.');
      return;
    }

    setUploading(true);
    try {
      const result = await api.upload<{ path: string }>('/uploads', file);
      onChange?.(result.path);
    } catch (error) {
      message.error(error instanceof ApiError ? error.displayMessage : 'Tải ảnh thất bại.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Flex align="center" gap={8} wrap>
      {value ? (
        <Image
          src={value}
          width={size}
          height={size}
          style={{ objectFit: 'cover', borderRadius: 6 }}
          alt="Ảnh minh hoạ"
        />
      ) : (
        <Flex
          align="center"
          justify="center"
          style={{
            width: size,
            height: size,
            borderRadius: 6,
            border: '1px dashed rgba(128,128,128,.5)',
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            chưa có
          </Typography.Text>
        </Flex>
      )}

      <input
        type="file"
        accept="image/*"
        // `hidden` thôi không đủ: CSS của AntD đặt `display` cho input nên thắng
        // thuộc tính hidden của trình duyệt, và ô chọn tệp gốc vẫn hiện ra.
        hidden
        style={{ display: 'none' }}
        ref={inputRef}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
          // Xoá value để chọn lại đúng tệp đó vẫn kích hoạt onChange.
          event.target.value = '';
        }}
      />

      <Flex vertical gap={4}>
        <Button
          size="small"
          icon={<UploadOutlined />}
          loading={uploading}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          {value ? 'Đổi ảnh' : label}
        </Button>
        {value && (
          <Button
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={disabled}
            onClick={() => onChange?.(null)}
          >
            Gỡ ảnh
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
