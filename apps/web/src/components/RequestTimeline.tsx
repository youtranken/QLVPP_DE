import { Empty, Skeleton, Timeline, Typography } from 'antd';
import { formatDateTime } from '../lib/format';
import { useRequestTimeline } from '../lib/admin-queries';

/** Nhãn + màu cho từng mốc. Hành động lạ vẫn hiện được, không nuốt mất. */
const MOC: Record<string, { nhan: string; mau: string }> = {
  'request.create': { nhan: 'Gửi đơn', mau: 'blue' },
  'request.approve': { nhan: 'Duyệt đơn', mau: 'green' },
  'request.reject': { nhan: 'Từ chối', mau: 'red' },
  'request.adjust': { nhan: 'Điều chỉnh đơn', mau: 'orange' },
  'request.cancel': { nhan: 'Huỷ đơn', mau: 'gray' },
  'request.deliver_all': { nhan: 'Xác nhận đã giao đủ', mau: 'green' },
  'request.undeliver_all': { nhan: 'Hoàn tác đã giao', mau: 'orange' },
};

/**
 * Dòng thời gian của một đơn (CORE-9b).
 *
 * Trả lời câu hỏi nhân viên hay phải đi hỏi: *đơn của tôi đang ở đâu, ai xử lý,
 * lúc nào*. Dữ liệu lấy từ nhật ký audit — thứ vốn đã ghi đủ, chỉ chưa ai cho xem.
 */
export function RequestTimeline({ requestId }: { requestId: string | null }) {
  const { data, isPending, error } = useRequestTimeline(requestId);

  if (!requestId) return null;
  if (isPending) return <Skeleton active paragraph={{ rows: 2 }} />;
  if (error || !data || data.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có mốc nào" />;
  }

  return (
    <Timeline
      items={data.map((moc) => {
        const meta = MOC[moc.action];
        return {
          color: meta?.mau ?? 'blue',
          children: (
            <>
              <Typography.Text>{meta?.nhan ?? moc.action}</Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {moc.actorName ?? 'Hệ thống'} · {formatDateTime(moc.createdAt)}
              </Typography.Text>
            </>
          ),
        };
      })}
    />
  );
}
