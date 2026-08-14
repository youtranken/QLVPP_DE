import { DownloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Select, Table, Typography } from 'antd';
import { useState } from 'react';
import { useDepartments, useSummary, type SummaryRow } from '../../lib/admin-queries';
import { periodLabel } from '../../lib/format';
import { useCurrentPeriod } from '../../lib/queries';
import { PeriodPicker } from './PeriodPicker';

/** Tổng hợp theo món + xuất Excel trình ký (REPORT-1/2). */
export function AdminSummaryPage() {
  // Kỳ mặc định do máy chủ tính — khung ngày đăng ký admin sửa được nên FE
  // không tự suy ra. Lựa chọn của người dùng đè lên mặc định đó.
  const current = useCurrentPeriod();
  const [chon, setChon] = useState<string>();
  const period = chon ?? current;
  const [departmentId, setDepartmentId] = useState<string | undefined>();
  const { data: departments } = useDepartments();
  const { data, isFetching } = useSummary(period, departmentId);

  const exportUrl = `/api/export/requests.xlsx?period=${period}${
    departmentId ? `&departmentId=${departmentId}` : ''
  }`;
  // Chưa biết kỳ thì link tải sẽ trỏ sai — khoá nút cho tới khi biết.
  const sanSangXuat = Boolean(period);

  const rows = data?.items ?? [];
  const totalQty = rows.reduce((sum, row) => sum + row.totalQty, 0);
  const totalDelivered = rows.reduce((sum, row) => sum + row.deliveredQty, 0);

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Tổng hợp &amp; báo cáo
      </Typography.Title>

      <Card size="small">
        <Flex gap={8} wrap align="center">
          <PeriodPicker value={period} onChange={setChon} />
          <Select
            allowClear
            placeholder="Tất cả phòng ban"
            aria-label="Phòng ban"
            style={{ minWidth: 200 }}
            value={departmentId}
            onChange={setDepartmentId}
            options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
          {/* Button có `href` sẽ render thành thẻ <a>; trình duyệt tải thẳng từ API
              nên không phải giữ cả file trong bộ nhớ JS. */}
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            href={sanSangXuat ? exportUrl : undefined}
            disabled={!sanSangXuat}
            download
          >
            Tải Excel trình ký
          </Button>
        </Flex>
      </Card>

      <Alert
        type="info"
        showIcon
        title={`Kỳ ${period ? periodLabel(period) : '…'}: ${rows.length} loại món · tổng ${totalQty} đơn vị · đã giao ${totalDelivered}`}
        description="Không tính đơn đã bị từ chối hoặc đã huỷ."
      />

      <div className="vpp-scroll-x">
        <Table<SummaryRow>
          rowKey={(row) => `${row.name}|${row.unit}`}
          size="small"
          loading={isFetching}
          dataSource={rows}
          scroll={{ x: 620 }}
          pagination={false}
          locale={{ emptyText: 'Kỳ này chưa có đơn nào' }}
          columns={[
            {
              title: 'STT',
              width: 64,
              align: 'center',
              render: (_, __, index) => index + 1,
            },
            { title: 'Tên vật tư', dataIndex: 'name', minWidth: 240 },
            { title: 'ĐVT', dataIndex: 'unit', width: 100 },
            { title: 'SL đăng ký', dataIndex: 'totalQty', width: 120, align: 'center' },
            { title: 'SL đã giao', dataIndex: 'deliveredQty', width: 120, align: 'center' },
            { title: 'Số đơn', dataIndex: 'requestCount', width: 100, align: 'center' },
          ]}
        />
      </div>
    </Flex>
  );
}
