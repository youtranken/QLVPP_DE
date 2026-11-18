const today = {
  today: {
    title: 'Việc hôm nay',
    greet: '{{greeting}}, {{name}}',
    greeting: { morning: 'Chào buổi sáng', afternoon: 'Chào buổi chiều', evening: 'Chào buổi tối' },
    summary: {
      none: '{{date}} · không có việc cần xử lý',
      work_one: '{{date}} · {{count}} việc cần xử lý',
      work_other: '{{date}} · {{count}} việc cần xử lý',
      urgent_one: '{{count}} việc gấp',
      urgent_other: '{{count}} việc gấp',
    },
    openMonth: 'Mở Kỳ tháng',
    openDelivery: 'Mở Giao hàng',
    tilesLabel: 'Số việc',
    tileError: 'Không tải được',
    tiles: {
      none: 'Không có việc',
      review: { label: 'Món ngoài danh mục chờ duyệt', hint: 'người · kỳ tháng {{month}} · cũ nhất {{days}} ngày' },
      ready: { label: 'Giao được ngay', hint: 'người · tủ đủ cả phiếu' },
      arrivals: { label: 'Hàng NCC chưa về', hint: 'món · gửi NCC {{date}}', notSent: 'chưa gửi NCC' },
      backlog: { label: 'Còn nợ tháng trước', hint: 'người · {{months}} tháng' },
      period: { label: 'Kỳ tháng {{month}} đang đăng ký', labelPlain: 'Kỳ đang đăng ký', hint: 'khóa {{lock}} · còn {{days}} ngày' },
      low: { label: 'Tủ sắp hết', hint: 'món dưới mức tối thiểu' },
      left: { label: 'Người đã nghỉ còn phần', hint: 'chưa nhận' },
    },
    attention: {
      title: 'Cần chú ý',
      empty: 'Không có việc cần chú ý',
      waiting: 'Chờ duyệt {{days}} ngày',
      custom: '{{name}} (ngoài danh mục)',
      leftTag: 'Người đã nghỉ',
      leftQty: 'còn {{qty}} SL chưa nhận',
      review: 'Duyệt',
      open: 'Mở phiếu',
    },
  },
};

export default today;
