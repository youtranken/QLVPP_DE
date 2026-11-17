const month = {
  month: {
    title: 'Kỳ tháng {{month}}',
    search: 'Tìm người hoặc phòng',
    period: {
      label: 'Chọn kỳ',
      month: 'Tháng {{month}}/{{year}}',
      prev: 'Tháng trước',
      next: 'Tháng sau',
      status: { locked: 'Đang giao', open: 'Đang đăng ký', past: 'Đã qua' },
      toOpen: 'Tháng {{month}} đang đăng ký',
      toLocked: 'Tháng {{month}} đang giao',
    },
    steps: {
      label: 'Các bước của tháng',
      register: 'Đăng ký',
      send: 'Gửi NCC',
      arrive: 'Nhận hàng',
      deliver: 'Giao',
    },
    value: {
      sendTodo: 'Chưa gửi',
      sent: 'Đã gửi',
      noOrder: 'Không cần đề nghị',
      noOrderArrive: 'Không có đơn gửi NCC',
      arrive: '{{done}}/{{total}} món',
      deliver: '{{done}}/{{total}} phiếu',
      none: '—',
    },
    chips: {
      label: 'Lọc phiếu',
      all: 'Tất cả',
      noted: 'Có ghi chú',
      undelivered: 'Chưa giao xong',
      pending: 'Có món chờ duyệt',
    },
    table: {
      team: 'Nhóm',
      noDepartment: 'Chưa có phòng',
    },
    notes: {
      overMax: 'Vượt tối đa',
      adjusted: 'Adm D&E đã điều chỉnh',
      nothing: 'Không có gì để giao',
      custom: 'Món ngoài danh mục',
    },
    left: {
      action: 'Xử lý',
      debt: 'Xem nợ tháng trước',
    },
  },
};

export default month;
