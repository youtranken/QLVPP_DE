import { PrinterOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Flex, Select, Skeleton, Typography } from 'antd';
import { useMemo, useState } from 'react';
import { useDepartments, useHandover, type DongPhieuPhat } from '../../lib/admin-queries';
import { periodLabel } from '../../lib/format';
import { useCurrentPeriod } from '../../lib/queries';
import { PeriodPicker } from './PeriodPicker';

/** Gom dòng theo phòng ban → từng người, giữ nguyên thứ tự server đã sắp. */
function gomTheoPhongBan(rows: DongPhieuPhat[]) {
  const phong = new Map<string, Map<string, DongPhieuPhat[]>>();
  for (const row of rows) {
    const tenPhong = row.departmentName || 'Chưa có phòng ban';
    const tenNguoi = row.userName ?? row.userEmail ?? 'Không rõ';
    if (!phong.has(tenPhong)) phong.set(tenPhong, new Map());
    const nguoi = phong.get(tenPhong)!;
    if (!nguoi.has(tenNguoi)) nguoi.set(tenNguoi, []);
    nguoi.get(tenNguoi)!.push(row);
  }
  return [...phong.entries()].map(([ten, nguoi]) => ({ ten, nguoi: [...nguoi.entries()] }));
}

/**
 * Phiếu phát hàng in được (REPORT-4).
 *
 * Đóng đúng khoảng trống giữa "đã duyệt" và "đã giao": hành chính cầm tờ này đi
 * phát cho từng người và xin chữ ký. Trước đây phần này viết tay ngoài hệ thống.
 *
 * Bảng dựng bằng HTML thuần chứ không dùng Table của AntD: bảng của thư viện có
 * phần cuộn và tiêu đề dính, in ra bị cắt mất dòng.
 */
export function AdminHandoverPage() {
  const kyHienTai = useCurrentPeriod();
  const [chonKy, setChonKy] = useState<string>();
  const period = chonKy ?? kyHienTai;
  const [departmentId, setDepartmentId] = useState<string>();

  const { data: departments } = useDepartments();
  const { data, isPending } = useHandover(period, departmentId);

  const nhom = useMemo(() => gomTheoPhongBan(data?.rows ?? []), [data]);

  return (
    <Flex vertical gap={16}>
      <Flex align="center" justify="space-between" wrap gap={8} className="vpp-khong-in">
        <Typography.Title level={4} style={{ margin: 0 }}>
          Phiếu phát hàng
        </Typography.Title>
        <Button
          type="primary"
          icon={<PrinterOutlined />}
          disabled={!data || data.rows.length === 0}
          onClick={() => window.print()}
        >
          In phiếu
        </Button>
      </Flex>

      <Card size="small" className="vpp-khong-in">
        <Flex gap={8} wrap align="center">
          <PeriodPicker value={period} onChange={setChonKy} />
          <Select
            allowClear
            placeholder="Tất cả phòng ban"
            aria-label="Phòng ban"
            style={{ minWidth: 220 }}
            value={departmentId}
            onChange={setDepartmentId}
            options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </Flex>
      </Card>

      <Alert
        className="vpp-khong-in"
        type="info"
        showIcon
        title="Phiếu chỉ gồm đơn đã gửi / đã duyệt / đã giao"
        description="Đơn bị từ chối và đơn đã huỷ không xuất hiện, giống báo cáo trình ký."
      />

      {isPending ? (
        <Skeleton active />
      ) : nhom.length === 0 ? (
        <Card>
          <Empty description="Kỳ này chưa có đơn nào để phát" />
        </Card>
      ) : (
        <div className="vpp-phieu">
          <div className="vpp-phieu-tieude">
            <h2>PHIẾU PHÁT VĂN PHÒNG PHẨM</h2>
            <p>Kỳ {periodLabel(data?.period ?? period ?? '')}</p>
          </div>

          {nhom.map((phong) => (
            <section key={phong.ten} className="vpp-phieu-phong">
              <h3>Phòng: {phong.ten}</h3>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>STT</th>
                    <th>Người nhận</th>
                    <th>Tên món</th>
                    <th style={{ width: 70 }}>ĐVT</th>
                    <th style={{ width: 60 }}>SL</th>
                    <th style={{ width: 150 }}>Ký nhận</th>
                  </tr>
                </thead>
                <tbody>
                  {phong.nguoi.flatMap(([tenNguoi, dong], thuTuNguoi) =>
                    dong.map((row, index) => (
                      <tr key={`${tenNguoi}-${row.code}-${row.itemName}`}>
                        {/* STT và tên người gộp ô cho cả cụm dòng của họ — người
                            phát đọc theo từng NGƯỜI, không theo từng món. Số thứ
                            tự vì vậy đếm theo người, không đếm theo dòng. */}
                        {index === 0 && <td rowSpan={dong.length}>{thuTuNguoi + 1}</td>}
                        {index === 0 && <td rowSpan={dong.length}>{tenNguoi}</td>}
                        <td>{row.itemName}</td>
                        <td>{row.unit}</td>
                        <td style={{ textAlign: 'center' }}>{row.quantity}</td>
                        {/* Ô ký nhận để trống, gộp cho cả cụm — ký một lần cho
                            toàn bộ món của mình. */}
                        {index === 0 && <td rowSpan={dong.length} />}
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </Flex>
  );
}
