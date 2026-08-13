import { periodForDate } from '@vpp/shared';
import { Card, Col, Empty, Flex, Row, Skeleton, Statistic, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { EChart } from '../../components/EChart';
import { useStats } from '../../lib/admin-queries';
import { periodLabel } from '../../lib/format';
import { PeriodPicker } from './PeriodPicker';

/** Lùi `months` kỳ so với kỳ hiện tại, trả về chuỗi 'YYYY-MM'. */
function periodBefore(months: number): string {
  const [year, month] = periodForDate().split('-').map(Number);
  const date = new Date(year, month - 1 - months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Bảng điều khiển: thống kê nhiều kỳ bằng biểu đồ (REPORT-3). */
export function AdminDashboardPage() {
  const [from, setFrom] = useState<string>(periodBefore(5));
  const [to, setTo] = useState<string>(periodForDate());
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

  if (isPending) return <Skeleton active />;

  const hasData = (data?.byPeriod.length ?? 0) > 0;

  return (
    <Flex vertical gap={16}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Bảng điều khiển
      </Typography.Title>

      <Card size="small">
        <Flex gap={8} wrap align="center">
          <span>Từ kỳ</span>
          <PeriodPicker value={from} onChange={(value) => setFrom(value ?? periodBefore(5))} />
          <span>đến kỳ</span>
          <PeriodPicker value={to} onChange={(value) => setTo(value ?? periodForDate())} />
        </Flex>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Tổng số đơn" value={data?.totals.requestCount ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="Đơn đã giao đủ" value={data?.totals.deliveredRequests ?? 0} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Tỉ lệ đã giao"
              value={Math.round((data?.totals.deliveredRatio ?? 0) * 100)}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

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
    </Flex>
  );
}
