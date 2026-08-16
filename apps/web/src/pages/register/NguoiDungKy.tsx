import { UserSwitchOutlined } from '@ant-design/icons';
import { Alert, Card, Flex, Select, Typography } from 'antd';
import { useState } from 'react';
import { useDirectoryUsers } from '../../lib/admin-queries';

/**
 * Chọn người ĐỨNG TÊN đơn (CORE-2c) — chỉ admin thấy.
 *
 * Nhiều nơi vẫn có người không dùng máy tính, hoặc đang nghỉ đúng kỳ đăng ký;
 * trước đây hành chính phải tự gom rồi nhét vào đơn của chính mình, làm hỏng báo
 * cáo theo người và theo phòng ban.
 */
export function NguoiDungKy({
  value,
  onChange,
}: {
  /** `undefined` = đăng ký cho chính mình. */
  value: { id: string; name: string } | undefined;
  onChange: (nguoi: { id: string; name: string } | undefined) => void;
}) {
  const [tim, setTim] = useState('');
  const { data, isFetching } = useDirectoryUsers(tim, 1);

  const nguoiDung = (data?.items ?? []).filter((user) => !user.disabled);

  return (
    <Card size="small">
      <Flex vertical gap={8}>
        <Flex gap={8} align="center" wrap>
          <UserSwitchOutlined />
          <Typography.Text>Đăng ký cho</Typography.Text>
          <Select
            showSearch
            allowClear
            style={{ minWidth: 280 }}
            aria-label="Đăng ký cho"
            placeholder="Chính tôi"
            loading={isFetching}
            value={value?.id}
            // Lọc ở SERVER, không lọc trong danh sách đã tải: danh bạ có thể vài
            // trăm người mà API chỉ trả về trang đầu.
            filterOption={false}
            onSearch={setTim}
            onChange={(id) => {
              const chon = nguoiDung.find((user) => user.id === id);
              onChange(
                chon ? { id: chon.id, name: chon.name ?? chon.email ?? 'Nhân viên' } : undefined,
              );
            }}
            options={nguoiDung.map((user) => ({
              value: user.id,
              label: `${user.name ?? user.email} · ${user.department ?? 'chưa có phòng ban'}`,
            }))}
          />
        </Flex>

        {value && (
          <Alert
            type="info"
            showIcon
            title={`Đơn này sẽ đứng tên ${value.name}`}
            description="Nhật ký ghi rõ bạn là người nhập hộ, và người đó cũng nhận được thông báo."
          />
        )}
      </Flex>
    </Card>
  );
}
