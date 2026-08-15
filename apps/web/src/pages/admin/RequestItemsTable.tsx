import { Card, Flex, Select, Table, Tag, Typography } from 'antd';
import { REQUEST_STATUSES, type RequestStatus } from '@vpp/shared';
import { useState } from 'react';
import { useAdminRequest, useRequestItems, type RequestItemRow } from '../../lib/admin-queries';
import { periodLabel, STATUS_META } from '../../lib/format';
import { RequestDetailDrawer } from './RequestDetailDrawer';

const PAGE_SIZE = 10;

/**
 * Danh sách đăng ký của nhân viên các phòng ban, **mỗi dòng một món** (CORE-10b).
 *
 * Khác với màn Duyệt đơn (mỗi dòng một đơn): ở đây nhìn được ngay phòng nào xin
 * món gì, bao nhiêu, mà không phải mở từng đơn. Việc DUYỆT vẫn theo cả đơn, nên
 * bấm vào dòng sẽ mở đúng đơn chứa món đó.
 */
export function RequestItemsTable() {
  const [status, setStatus] = useState<RequestStatus | undefined>();
  const [page, setPage] = useState(1);
  const [moRequestId, setMoRequestId] = useState<string | null>(null);

  const { data, isFetching } = useRequestItems({ status, page, pageSize: PAGE_SIZE });

  // Ngăn kéo duyệt cần CẢ ĐƠN (mọi dòng của nó) chứ không chỉ dòng đang bấm.
  // Hỏi đúng đơn đó, và chỉ khi thật sự mở.
  const { data: don } = useAdminRequest(moRequestId);

  return (
    <Card size="small">
      <Flex vertical gap={12}>
        <Flex gap={8} wrap align="center" justify="space-between">
          <Typography.Text type="secondary">
            Đăng ký của nhân viên các phòng ban — mỗi dòng một món. Bấm vào dòng để mở đơn và duyệt.
          </Typography.Text>
          <Select
            allowClear
            placeholder="Trạng thái"
            aria-label="Trạng thái"
            style={{ minWidth: 160 }}
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={REQUEST_STATUSES.map((value) => ({ value, label: STATUS_META[value].label }))}
          />
        </Flex>

        <div className="vpp-scroll-x">
          <Table<RequestItemRow>
            rowKey="id"
            size="small"
            loading={isFetching}
            dataSource={data?.items ?? []}
            scroll={{ x: 900 }}
            onRow={(row) => ({
              onClick: () => setMoRequestId(row.requestId),
              style: { cursor: 'pointer' },
            })}
            pagination={{
              current: page,
              pageSize: PAGE_SIZE,
              total: data?.total ?? 0,
              onChange: setPage,
              showSizeChanger: false,
              showTotal: (total) => `${total} dòng`,
            }}
            locale={{ emptyText: 'Chưa có đơn đăng ký nào' }}
            columns={[
              {
                title: 'STT',
                width: 60,
                align: 'center',
                // Đánh số liên tục qua các trang, không quay về 1 ở mỗi trang.
                render: (_, __, index) => (page - 1) * PAGE_SIZE + index + 1,
              },
              {
                title: 'Mã',
                dataIndex: 'itemCode',
                width: 110,
                render: (value: string | null) => value || '—',
              },
              { title: 'Tên món', dataIndex: 'name', minWidth: 200 },
              { title: 'ĐVT', dataIndex: 'unit', width: 80 },
              { title: 'SL', dataIndex: 'quantity', width: 70, align: 'center' },
              {
                title: 'Người đăng ký',
                dataIndex: 'userName',
                width: 150,
                render: (value: string | null) => value ?? '—',
              },
              {
                title: 'Phòng ban',
                dataIndex: 'departmentName',
                width: 130,
                render: (value: string | null) => value ?? '—',
              },
              {
                title: 'Kỳ',
                dataIndex: 'period',
                width: 120,
                render: (value: string) => periodLabel(value),
              },
              {
                title: 'Trạng thái',
                dataIndex: 'status',
                width: 130,
                render: (value: RequestStatus) => (
                  <Tag color={STATUS_META[value].color}>{STATUS_META[value].label}</Tag>
                ),
              },
            ]}
          />
        </div>
      </Flex>

      <RequestDetailDrawer
        request={don ?? null}
        open={Boolean(moRequestId)}
        onClose={() => setMoRequestId(null)}
      />
    </Card>
  );
}
