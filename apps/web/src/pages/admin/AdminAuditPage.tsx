import { Card, Flex, Select, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useAuditLog, type AuditEntry } from '../../lib/admin-queries';
import { formatDateTime } from '../../lib/format';

/** Nhãn tiếng Việt cho các hành động được ghi nhật ký. */
const ACTION_LABELS: Record<string, string> = {
  'request.create': 'Gửi đơn',
  'request.cancel': 'Huỷ đơn',
  'request.approve': 'Duyệt đơn',
  'request.reject': 'Từ chối đơn',
  'request.deliver_line': 'Giao một dòng',
  'request.deliver_all': 'Giao toàn bộ',
  'request.undeliver_all': 'Hoàn tác giao',
  'request.adjust': 'Điều chỉnh đơn',
  'directory.sync': 'Đồng bộ danh bạ',
  'auth.ambiguous_department': 'Cảnh báo nhiều phòng ban',
  'webhook.user.locked': 'PMH ID khoá user',
  'webhook.user.unlocked': 'PMH ID mở khoá user',
  'webhook.user.deleted': 'PMH ID xoá user',
  'webhook.user.groups_changed': 'PMH ID đổi nhóm user',
  'webhook.user.password_changed': 'PMH ID đổi mật khẩu user',
};

/** Nhật ký audit (ADMIN-5) — giữ vô thời hạn nên luôn phân trang. */
export function AdminAuditPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, isFetching } = useAuditLog(action, page);

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Nhật ký hoạt động
      </Typography.Title>

      <Card size="small">
        <Select
          allowClear
          placeholder="Lọc theo hành động"
          aria-label="Lọc theo hành động"
          style={{ minWidth: 260 }}
          value={action || undefined}
          onChange={(value) => {
            setAction(value ?? '');
            setPage(1);
          }}
          options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </Card>

      <div className="vpp-scroll-x">
        <Table<AuditEntry>
          rowKey="id"
          size="small"
          loading={isFetching}
          dataSource={data?.items ?? []}
          scroll={{ x: 780 }}
          pagination={{
            current: data?.page ?? page,
            pageSize: data?.pageSize ?? 20,
            total: data?.total ?? 0,
            showTotal: (total) => `${total} bản ghi`,
            onChange: setPage,
          }}
          expandable={{
            // Chi tiết là JSON tự do (dòng trước/sau khi điều chỉnh, lý do…),
            // hiện dạng thô để đối soát chính xác thay vì diễn giải sai.
            expandedRowRender: (row) => (
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                {JSON.stringify(row.detail, null, 2)}
              </pre>
            ),
            rowExpandable: (row) => row.detail !== null && row.detail !== undefined,
          }}
          columns={[
            {
              title: 'Thời điểm',
              dataIndex: 'createdAt',
              width: 170,
              render: (value: string) => formatDateTime(value),
            },
            {
              title: 'Người thực hiện',
              dataIndex: 'actorName',
              width: 180,
              render: (value: string | null) =>
                value === 'Hệ thống' ? <Tag>Hệ thống</Tag> : (value ?? '—'),
            },
            {
              title: 'Hành động',
              dataIndex: 'action',
              minWidth: 200,
              render: (value: string) => ACTION_LABELS[value] ?? value,
            },
            {
              title: 'Đối tượng',
              dataIndex: 'objectType',
              width: 140,
              render: (value: string | null) => value ?? '—',
            },
          ]}
        />
      </div>
    </Flex>
  );
}
