import { SyncOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Flex, Input, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { useDirectorySync, useDirectoryUsers, type DirectoryUser } from '../../lib/admin-queries';
import { formatDateTime } from '../../lib/format';

/**
 * Danh bạ nhân viên lấy từ PMH ID qua Directory API (ADMIN-3/4).
 * **Chỉ đọc** — danh tính do PMH ID quản, app không tạo/sửa/xoá tài khoản.
 */
export function AdminDirectoryPage() {
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isFetching } = useDirectoryUsers(search, page);
  const sync = useDirectorySync();

  const runSync = async () => {
    try {
      const result = await sync.mutateAsync();
      message.success(`Đã đồng bộ ${result.upserted}/${result.fetched} bản ghi`);
    } catch (error) {
      // Directory lỗi thì dữ liệu cũ vẫn giữ nguyên — báo rõ để admin không hiểu nhầm.
      message.error(error instanceof ApiError ? error.displayMessage : 'Đồng bộ thất bại.');
    }
  };

  return (
    <Flex vertical gap={16}>
      <Flex align="center" justify="space-between" wrap gap={8}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Danh bạ nhân viên
        </Typography.Title>
        <Button
          type="primary"
          icon={<SyncOutlined />}
          loading={sync.isPending}
          onClick={() => void runSync()}
        >
          Đồng bộ ngay
        </Button>
      </Flex>

      <Alert
        type="info"
        showIcon
        title="Dữ liệu đến từ PMH ID"
        description="Danh sách được đồng bộ tự động khoảng mỗi giờ. App không tạo hay sửa tài khoản — mọi thay đổi làm ở PMH ID."
      />

      <Card size="small">
        <Input.Search
          allowClear
          placeholder="Tìm theo tên hoặc email"
          style={{ maxWidth: 360 }}
          onSearch={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
      </Card>

      <div className="vpp-scroll-x">
        <Table<DirectoryUser>
          rowKey="id"
          size="small"
          loading={isFetching}
          dataSource={data?.items ?? []}
          scroll={{ x: 820 }}
          pagination={{
            current: data?.page ?? page,
            pageSize: data?.pageSize ?? 50,
            total: data?.total ?? 0,
            showTotal: (total) => `${total} người`,
            onChange: setPage,
          }}
          columns={[
            {
              title: 'Họ tên',
              dataIndex: 'name',
              minWidth: 180,
              render: (v: string | null) => v ?? '—',
            },
            {
              title: 'Email',
              dataIndex: 'email',
              minWidth: 200,
              render: (v: string | null) => v ?? '—',
            },
            {
              title: 'Mã NV',
              dataIndex: 'employeeCode',
              width: 100,
              render: (v: string | null) => v ?? '—',
            },
            {
              title: 'Phòng ban',
              dataIndex: 'department',
              width: 140,
              render: (v: string | null) => v ?? '—',
            },
            {
              title: 'Vai trò',
              dataIndex: 'role',
              width: 110,
              render: (role: DirectoryUser['role']) =>
                role === 'admin' ? <Tag color="gold">Quản trị</Tag> : <Tag>Nhân viên</Tag>,
            },
            {
              title: 'Đã đăng nhập',
              width: 150,
              render: (_, user) =>
                user.hasLoggedIn ? (
                  <Typography.Text type="secondary">
                    {formatDateTime(user.lastLoginAt)}
                  </Typography.Text>
                ) : (
                  <Tag>chưa bao giờ</Tag>
                ),
            },
            {
              title: 'Trạng thái',
              dataIndex: 'disabled',
              width: 110,
              render: (disabled: boolean) =>
                disabled ? <Tag color="red">Bị khoá</Tag> : <Tag color="green">Hoạt động</Tag>,
            },
          ]}
        />
      </div>
    </Flex>
  );
}
