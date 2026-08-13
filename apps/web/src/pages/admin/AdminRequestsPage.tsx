import { REQUEST_STATUSES, type RequestStatus } from '@vpp/shared';
import { Button, Card, Flex, Select, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useAdminRequests, useDepartments, type AdminRequest } from '../../lib/admin-queries';
import { formatDateTime, periodLabel, STATUS_META } from '../../lib/format';
import { PeriodPicker } from './PeriodPicker';
import { RequestDetailDrawer } from './RequestDetailDrawer';

/** Danh sách đăng ký cho quản trị viên: lọc + phân trang + mở chi tiết (CORE-10). */
export function AdminRequestsPage() {
  const [period, setPeriod] = useState<string | undefined>();
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const [status, setStatus] = useState<RequestStatus | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<AdminRequest | null>(null);

  const { data: departments } = useDepartments();
  const { data, isFetching } = useAdminRequests({ period, departmentId, status, page, pageSize });

  /** Đổi bộ lọc thì phải về trang 1, nếu không sẽ thấy trang trống. */
  const withReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Duyệt đơn đăng ký
      </Typography.Title>

      <Card size="small">
        <Flex gap={8} wrap>
          <PeriodPicker value={period} onChange={withReset(setPeriod)} allowClear />
          <Select
            allowClear
            placeholder="Phòng ban"
            aria-label="Phòng ban"
            style={{ minWidth: 180 }}
            value={departmentId}
            onChange={withReset(setDepartmentId)}
            options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
          <Select
            allowClear
            placeholder="Trạng thái"
            aria-label="Trạng thái"
            style={{ minWidth: 160 }}
            value={status}
            onChange={withReset(setStatus)}
            options={REQUEST_STATUSES.map((value) => ({
              value,
              label: STATUS_META[value].label,
            }))}
          />
          {(period || departmentId || status) && (
            <Button
              onClick={() => {
                setPeriod(undefined);
                setDepartmentId(undefined);
                setStatus(undefined);
                setPage(1);
              }}
            >
              Xoá bộ lọc
            </Button>
          )}
        </Flex>
      </Card>

      <div className="vpp-scroll-x">
        <Table<AdminRequest>
          rowKey="id"
          size="small"
          loading={isFetching}
          dataSource={data?.items ?? []}
          scroll={{ x: 760 }}
          onRow={(record) => ({ onClick: () => setSelected(record), style: { cursor: 'pointer' } })}
          pagination={{
            current: data?.page ?? page,
            pageSize: data?.pageSize ?? pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (total) => `${total} đơn`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
          columns={[
            { title: 'Mã đơn', dataIndex: 'code', width: 170 },
            {
              title: 'Người đăng ký',
              minWidth: 180,
              render: (_, row) => row.userName ?? row.userEmail ?? '—',
            },
            {
              title: 'Phòng ban',
              dataIndex: 'departmentName',
              width: 140,
              render: (value: string | null) => value ?? '—',
            },
            {
              title: 'Kỳ',
              dataIndex: 'period',
              width: 130,
              render: (value: string) => periodLabel(value),
            },
            { title: 'Số món', width: 90, align: 'center', render: (_, row) => row.items.length },
            {
              title: 'Trạng thái',
              dataIndex: 'status',
              width: 130,
              render: (value: RequestStatus) => (
                <Tag color={STATUS_META[value].color}>{STATUS_META[value].label}</Tag>
              ),
            },
            {
              title: 'Gửi lúc',
              dataIndex: 'createdAt',
              width: 160,
              render: (value: string) => formatDateTime(value),
            },
          ]}
        />
      </div>

      <RequestDetailDrawer
        // Lấy bản mới nhất từ danh sách để ngăn kéo cập nhật ngay sau mỗi thao tác.
        request={data?.items.find((item) => item.id === selected?.id) ?? selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </Flex>
  );
}
