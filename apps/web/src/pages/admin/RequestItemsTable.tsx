import { REQUEST_STATUSES, type RequestStatus } from '@vpp/shared';
import { Button, Empty, Flex, Select, Table, Tag, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useAdminRequest, useRequestItems, type RequestItemRow } from '../../lib/admin-queries';
import { periodLabel, STATUS_META } from '../../lib/format';
import { PeriodPicker } from './PeriodPicker';
import { RequestDetailDrawer } from './RequestDetailDrawer';

const PAGE_SIZE = 10;

/**
 * Danh sách đăng ký của nhân viên các phòng ban, **mỗi dòng một món** (CORE-10b).
 *
 * Khác với màn Duyệt đơn (mỗi dòng một đơn): ở đây nhìn được ngay phòng nào xin
 * món gì, bao nhiêu, mà không phải mở từng đơn. Việc DUYỆT vẫn theo cả đơn, nên
 * bấm vào dòng sẽ mở đúng đơn chứa món đó.
 *
 * Bộ lọc trạng thái do TRANG CHA giữ, để các thẻ số liệu bấm vào là lọc được.
 */
export function RequestItemsTable({
  status,
  onStatusChange,
}: {
  status: RequestStatus | undefined;
  onStatusChange: (status: RequestStatus | undefined) => void;
}) {
  const [period, setPeriod] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [moRequestId, setMoRequestId] = useState<string | null>(null);

  const { data, isFetching } = useRequestItems({ status, period, page, pageSize: PAGE_SIZE });

  // Ngăn kéo duyệt cần CẢ ĐƠN (mọi dòng của nó) chứ không chỉ dòng đang bấm.
  // Hỏi đúng đơn đó, và chỉ khi thật sự mở.
  const { data: don } = useAdminRequest(moRequestId);

  const rows = useMemo(() => data?.items ?? [], [data]);
  // Chưa ai đặt mã thì cột Mã chỉ toàn dấu gạch — chiếm chỗ mà không mang tin.
  const coMa = rows.some((row) => row.itemCode);

  const doiLoc =
    <T,>(dat: (value: T) => void) =>
    (value: T) => {
      dat(value);
      setPage(1);
    };

  return (
    <Flex vertical gap={12}>
      <Flex gap={8} wrap align="center" justify="space-between">
        <Flex gap={8} wrap align="center">
          <Select
            allowClear
            placeholder="Mọi trạng thái"
            aria-label="Trạng thái"
            style={{ minWidth: 170 }}
            value={status}
            onChange={doiLoc(onStatusChange)}
            options={REQUEST_STATUSES.map((value) => ({ value, label: STATUS_META[value].label }))}
          />
          <PeriodPicker value={period} onChange={doiLoc(setPeriod)} allowClear label="Mọi kỳ" />
          {(status || period) && (
            <Button
              type="link"
              onClick={() => {
                onStatusChange(undefined);
                setPeriod(undefined);
                setPage(1);
              }}
            >
              Xoá lọc
            </Button>
          )}
        </Flex>
        <Typography.Text type="secondary">Bấm vào một dòng để mở đơn và duyệt</Typography.Text>
      </Flex>

      {/* AntD tự lo cuộn ngang qua scroll.x — bọc thêm div cuộn nữa sinh ra
          thanh cuộn thừa lồng trong thanh cuộn. */}
      <Table<RequestItemRow>
        rowKey="id"
        size="middle"
        loading={isFetching}
        dataSource={rows}
        scroll={{ x: 820 }}
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
          hideOnSinglePage: true,
        }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                status || period ? 'Không có dòng nào khớp bộ lọc' : 'Chưa có đơn đăng ký nào'
              }
            />
          ),
        }}
        columns={[
          {
            title: 'STT',
            width: 60,
            align: 'center',
            // Đánh số liên tục qua các trang, không quay về 1 ở mỗi trang.
            render: (_, __, index) => (
              <Typography.Text type="secondary">
                {(page - 1) * PAGE_SIZE + index + 1}
              </Typography.Text>
            ),
          },
          ...(coMa
            ? [
                {
                  title: 'Mã',
                  dataIndex: 'itemCode',
                  width: 110,
                  render: (value: string | null) =>
                    value ? <Typography.Text code>{value}</Typography.Text> : '—',
                },
              ]
            : []),
          {
            title: 'Tên món',
            dataIndex: 'name',
            minWidth: 200,
            render: (value: string) => <Typography.Text strong>{value}</Typography.Text>,
          },
          {
            title: 'Số lượng',
            dataIndex: 'quantity',
            width: 110,
            align: 'right',
            // Gộp số với đơn vị: hai cột rời nhau khiến mắt phải nhảy qua lại
            // mới đọc được "20 cây".
            render: (value: number, row) => (
              <>
                <Typography.Text strong>{value}</Typography.Text>{' '}
                <Typography.Text type="secondary">{row.unit}</Typography.Text>
              </>
            ),
          },
          {
            title: 'Người đăng ký',
            dataIndex: 'userName',
            minWidth: 150,
            render: (value: string | null) => value ?? '—',
          },
          {
            // Giữ cột riêng chứ không gộp vào tên người: đây là chiều admin hay
            // rà nhất — "phòng nào đang xin gì".
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
              <Tag color={STATUS_META[value].color} style={{ marginInlineEnd: 0 }}>
                {STATUS_META[value].label}
              </Tag>
            ),
          },
        ]}
      />

      <RequestDetailDrawer
        request={don ?? null}
        open={Boolean(moRequestId)}
        onClose={() => setMoRequestId(null)}
      />
    </Flex>
  );
}
