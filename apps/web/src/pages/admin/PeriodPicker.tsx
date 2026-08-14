import { Select } from 'antd';
import { periodLabel } from '../../lib/format';
import { useCurrentPeriod } from '../../lib/queries';

/**
 * Chọn kỳ dạng 'YYYY-MM'. Liệt kê sẵn 12 kỳ quanh kỳ hiện tại thay vì dùng
 * DatePicker: kỳ là tháng, và danh sách ngắn thì chọn nhanh hơn nhiều.
 *
 * Kỳ hiện tại lấy TỪ MÁY CHỦ — khung ngày đăng ký do admin đặt nên trình duyệt
 * không tự suy ra được.
 */
export function PeriodPicker({
  value,
  onChange,
  allowClear = false,
  style,
  label = 'Chọn kỳ',
}: {
  value?: string;
  onChange: (period: string | undefined) => void;
  allowClear?: boolean;
  style?: React.CSSProperties;
  /** Nhãn trợ năng — cũng là chỗ bám của e2e thay vì class nội bộ của AntD. */
  label?: string;
}) {
  const current = useCurrentPeriod();
  const [year, month] = (current ?? '').split('-').map(Number);

  const options = current
    ? Array.from({ length: 13 }, (_, index) => {
        // Từ kỳ hiện tại lùi dần 12 kỳ.
        const date = new Date(year, month - 1 - index, 1);
        const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return { value: period, label: periodLabel(period) };
      })
    : [];

  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      allowClear={allowClear}
      loading={!current}
      placeholder={label}
      aria-label={label}
      style={{ minWidth: 160, ...style }}
    />
  );
}
