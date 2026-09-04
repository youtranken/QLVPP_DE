import { RightOutlined } from '@ant-design/icons';
import type { RequestStatus } from '@vpp/shared';
import { Button, Card, Col, Empty, Flex, Row, Skeleton, Statistic, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../../App';
import { EChart } from '../../components/EChart';
import { useAdminOverview, useStats } from '../../lib/admin-queries';
import { useCurrentPeriod } from '../../lib/queries';
import { periodLabel, shiftPeriod } from '../../lib/format';
import { OverviewCards } from './OverviewCards';
import { PeriodPicker } from './PeriodPicker';
import { RequestItemsTable } from './RequestItemsTable';

/**
 * Bảng điều khiển — trang đầu tiên của quản trị viên.
 *
 * Xếp theo thứ tự admin cần: **việc đang chờ** (hàng thẻ số liệu) → **duyệt đơn**
 * ngay tại chỗ → **xu hướng nhiều kỳ** để cuối vì mỗi tháng mới xem một lần.
 * Đọc từ trên xuống là đi từ "phải làm gì bây giờ" tới "tháng rồi ra sao".
 */
export function AdminDashboardPage() {
  const navigate = useNavigate();
  const { data: tongQuan } = useAdminOverview();

  /**
   * Bộ lọc trạng thái dùng chung giữa hàng thẻ và bảng duyệt đơn, nên nó nằm ở
   * TRANG chứ không nằm trong bảng — bấm thẻ là bảng đổi theo.
   *
   * Mặc định mở ra là **đơn chờ duyệt**: đó là việc admin phải làm, không phải
   * toàn bộ lịch sử. Xem tất cả chỉ cách một cú bấm (bấm lại thẻ, hoặc "Xoá lọc").
   */
  const [status, setStatus] = useState<RequestStatus | undefined>('submitted');

  // Kỳ hiện tại do máy chủ tính (khung ngày admin đặt được), nên mặc định của
  // bộ lọc chỉ có sau khi tải xong — giữ lựa chọn của người dùng đè lên mặc định.
  const current = useCurrentPeriod();
  const [chonFrom, setChonFrom] = useState<string>();
  const [chonTo, setChonTo] = useState<string>();
  const from = chonFrom ?? (current ? shiftPeriod(current, -5) : undefined);
  const to = chonTo ?? current;
  const { data, isPending } = useStats(from, to);

  const byPeriodOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      // Ghim chú giải lên đỉnh và chừa `grid.top` tương ứng, nếu không nó rơi
      // xuống đè lên nhãn trục hoành.
      legend: { data: ['Số đơn', 'Số món'], top: 0 },
      grid: { left: 44, right: 16, top: 48, bottom: 40, containLabel: true },
      xAxis: {
        type: 'category',
        data: (data?.byPeriod ?? []).map((row) => periodLabel(row.period)),
      },
      yAxis: { type: 'value', minInterval: 1 },
      series: [
        {
          name: 'Số đơn',
          type: 'bar',
          data: (data?.byPeriod ?? []).map((row) => row.requestCount),
          itemStyle: { color: '#1d68b5' },
        },
        {
          name: 'Số món',
          type: 'bar',
          data: (data?.byPeriod ?? []).map((row) => row.itemQty),
          itemStyle: { color: '#7cb6f0' },
        },
      ],
    }),
    [data],
  );

  const byDepartmentOption = useMemo(
    () => ({
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, type: 'scroll' },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['50%', '45%'],
          data: (data?.byDepartment ?? []).map((row) => ({
            name: row.departmentName,
            value: row.itemQty,
          })),
          label: { show: false },
        },
      ],
    }),
    [data],
  );

  const hasData = (data?.byPeriod.length ?? 0) > 0;

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Bảng điều khiển
      </Typography.Title>

      <OverviewCards tongQuan={tongQuan} dangLoc={status} onLoc={setStatus} />

      {/* Duyệt đơn ngay tại đây: bấm một thẻ số liệu rồi xử lý luôn, không phải
          nhớ con số rồi đi sang màn khác tìm lại. Màn Duyệt đơn riêng vẫn còn cho
          việc lọc sâu theo phòng ban / tìm theo mã đơn và duyệt hàng loạt. */}
      <Card
        size="small"
        title="Duyệt đơn"
        extra={
          <Button
            type="link"
            icon={<RightOutlined />}
            iconPosition="end"
            onClick={() => navigate(routes.adminRequests)}
          >
            Mở màn duyệt đơn đầy đủ
          </Button>
        }
      >
        <RequestItemsTable status={status} onStatusChange={setStatus} />
      </Card>

      {/* Nhóm số liệu THỨ HAI của trang, phạm vi khác hẳn hàng thẻ bên trên (một
          khoảng nhiều kỳ, không phải việc đang tồn). Gói bộ chọn kỳ và ba con số
          của nó vào CHUNG một khối, để thấy ngay ba số này là của khoảng kỳ đang
          chọn chứ không phải của hôm nay. */}
      <Card size="small" title="Thống kê theo khoảng kỳ">
        {/* Bộ chọn kỳ để trong THÂN thẻ chứ không đặt ở `extra`: trên màn hẹp AntD
            xếp title và extra chung một hàng, extra dài sẽ bóp tiêu đề mất tăm —
            đúng chỗ mà mục này cần nhất một cái tên. */}
        <Flex vertical gap={12}>
          <Flex gap={8} wrap align="center">
            <span>Từ kỳ</span>
            {/* Xoá lựa chọn ⇒ quay về mặc định suy từ kỳ hiện tại của máy chủ. */}
            <PeriodPicker value={from} onChange={setChonFrom} />
            <span>đến kỳ</span>
            <PeriodPicker value={to} onChange={setChonTo} />
          </Flex>

          {isPending ? (
            <Skeleton active paragraph={{ rows: 1 }} />
          ) : (
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <Statistic title="Tổng số đơn" value={data?.totals.requestCount ?? 0} />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic title="Đơn đã giao đủ" value={data?.totals.deliveredRequests ?? 0} />
              </Col>
              <Col xs={24} sm={8}>
                <Statistic
                  title="Tỉ lệ đã giao"
                  value={Math.round((data?.totals.deliveredRatio ?? 0) * 100)}
                  suffix="%"
                />
              </Col>
            </Row>
          )}
        </Flex>
      </Card>

      {isPending ? null : (
        <>
          {!hasData ? (
            <Card>
              <Empty description="Chưa có dữ liệu trong khoảng kỳ đã chọn" />
            </Card>
          ) : (
            <Row gutter={[16, 16]}>
              <Col xs={24} lg={14}>
                <Card title="Số đơn và số món theo kỳ">
                  <EChart option={byPeriodOption} height={320} />
                </Card>
              </Col>
              <Col xs={24} lg={10}>
                <Card title="Số món theo phòng ban">
                  <EChart option={byDepartmentOption} height={320} />
                </Card>
              </Col>
            </Row>
          )}
        </>
      )}
    </Flex>
  );
}
