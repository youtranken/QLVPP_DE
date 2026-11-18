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
      review: { label: 'Món ngoài danh mục chờ duyệt', hint_one: 'người · kỳ tháng {{month}} · cũ nhất {{count}} ngày', hint_other: 'người · kỳ tháng {{month}} · cũ nhất {{count}} ngày' },
      ready: { label: 'Giao được ngay', hint: 'người · tủ đủ cả phiếu' },
      arrivals: { label: 'Hàng NCC chưa về', hint: 'món · gửi NCC {{date}}', notSent: 'chưa gửi NCC' },
      backlog: { label: 'Còn nợ tháng trước', hint_one: 'người · {{count}} tháng', hint_other: 'người · {{count}} tháng' },
      period: { label: 'Kỳ tháng {{month}} đang đăng ký', labelPlain: 'Kỳ đang đăng ký', hint_one: 'khóa {{lock}} · còn {{count}} ngày', hint_other: 'khóa {{lock}} · còn {{count}} ngày' },
      low: { label: 'Tủ sắp hết', hint: 'món dưới mức tối thiểu' },
      left: { label: 'Người đã nghỉ còn phần', hint: 'chưa nhận' },
    },
    attention: {
      title: 'Cần chú ý',
      empty: 'Không có việc cần chú ý',
      waiting_one: 'Chờ duyệt {{count}} ngày',
      waiting_other: 'Chờ duyệt {{count}} ngày',
      custom: '{{name}} (ngoài danh mục)',
      leftTag: 'Người đã nghỉ',
      leftQty_one: 'còn {{count}} SL chưa nhận',
      leftQty_other: 'còn {{count}} SL chưa nhận',
      review: 'Duyệt',
      open: 'Mở phiếu',
      error: { review: 'Không tải được món chờ duyệt — thử lại.', people: 'Không tải được người đã nghỉ còn phần — thử lại.' },
    },
  },
};

export default today;
