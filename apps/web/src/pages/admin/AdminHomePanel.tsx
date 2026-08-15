import type { RequestStatus } from '@vpp/shared';
import { Card, Flex } from 'antd';
import { useState } from 'react';
import { useAdminOverview } from '../../lib/admin-queries';
import { OverviewCards } from './OverviewCards';
import { RequestItemsTable } from './RequestItemsTable';

/**
 * Phần dành cho quản trị viên ở trang chủ: bốn con số của kỳ đang nhận, rồi tới
 * danh sách đăng ký của các phòng ban.
 *
 * Bộ lọc trạng thái nằm ở ĐÂY chứ không nằm trong bảng, để thẻ số liệu và bảng
 * dùng chung một trạng thái — bấm thẻ là bảng đổi theo.
 */
export function AdminHomePanel() {
  const { data: tongQuan } = useAdminOverview();

  // Mặc định mở ra là **đơn chờ duyệt**: đó là việc admin phải làm, không phải
  // toàn bộ lịch sử. Xem tất cả chỉ cách một cú bấm ("Tổng số món" hoặc Xoá lọc).
  const [status, setStatus] = useState<RequestStatus | undefined>('submitted');

  return (
    <Flex vertical gap={16}>
      <OverviewCards tongQuan={tongQuan} dangLoc={status} onLoc={setStatus} />
      <Card size="small">
        <RequestItemsTable status={status} onStatusChange={setStatus} />
      </Card>
    </Flex>
  );
}
