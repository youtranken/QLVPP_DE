import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { App, Button, Flex, Image, Typography } from 'antd';
import { useState } from 'react';
import { ApiError, api } from '../lib/api';

/** Ảnh đính kèm tối đa 5MB (SDD §9) — kiểm ở đây để báo lỗi sớm; server vẫn kiểm lại. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * Chọn / đổi / gỡ một ảnh. Tải lên NGAY khi chọn để lấy đường dẫn; nơi gọi chỉ
 * giữ đường dẫn đó. Dùng chung cho ảnh minh hoạ món (admin) và ảnh mục "Khác".
 *
 * Ô chọn tệp nằm TRONG SUỐT ĐÈ LÊN nút, nên cú bấm của người dùng rơi thẳng vào
 * `<input type="file">` và trình duyệt tự mở hộp thoại. KHÔNG gọi `input.click()`
 * bằng JavaScript: cú bấm gián tiếp đó bị một số trình duyệt và tiện ích mở rộng
 * chặn im lặng — bấm nút mà không có gì xảy ra, không báo lỗi gì cả.
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

      <Flex vertical gap={4}>
        <div style={{ position: 'relative', display: 'inline-flex' }}>
          {/*
            Nút chỉ để NHÌN: ô chọn tệp đè bên trên mới là thứ nhận cú bấm, tiêu
            điểm bàn phím và tên gọi cho trình đọc màn hình. Không ẩn nút khỏi cây
            trợ năng thì người dùng nghe thấy hai nút "Đổi ảnh" nằm cạnh nhau.
          */}
          <Button
            size="small"
            icon={<UploadOutlined />}
            loading={uploading}
            disabled={disabled}
            tabIndex={-1}
            aria-hidden
            style={{ width: '100%' }}
          >
            {value ? 'Đổi ảnh' : label}
          </Button>

          {/*
            Trong lúc đang tải hoặc khi bị khoá thì gỡ hẳn ô chọn tệp, để không ai
            chọn được ảnh thứ hai đè lên ảnh đang tải dở.
          */}
          {!disabled && !uploading && (
            <input
              type="file"
              accept="image/*"
              aria-label={value ? 'Đổi ảnh' : label}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
              }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void pick(file);
                // Xoá value để chọn lại đúng tệp đó vẫn kích hoạt onChange.
                event.target.value = '';
              }}
            />
          )}
        </div>
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
