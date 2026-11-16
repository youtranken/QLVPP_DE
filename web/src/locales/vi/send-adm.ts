const sendAdm = {
  sendAdm: {
    actions: { print: 'Xem tổng kết', xlsx: 'Xuất Excel mẫu phòng' },
    orders: {
      title: 'Số đề nghị',
      item: 'Món',
      registered: 'Đăng ký',
      backlog: 'Nợ tháng trước',
      stock: 'Tủ hiện có (tham khảo)',
      need: 'Tổng cần',
      qty: 'Đề nghị',
      qtyLabel: 'Đề nghị: {{name}}',
      error: { max: 'Tối đa 1.000', sent: 'Bản đã gửi ghi số này; nay tối đa 1.000, sửa lại', decimal: 'Nhập số nguyên', negative: 'Nhập số từ 0', invalid: 'Nhập số từ 0 đến 1.000' },
      overMax: 'Vượt 1.000, kiểm lại',
    },
    leave: {
      title: 'Bỏ số Đề nghị vừa sửa?',
      body: 'Bạn đã sửa {{n}} món nhưng chưa Xem tổng kết và bấm Đồng ý và in. Rời trang sẽ mất các số này.',
      stay: 'Ở lại',
      discard: 'Bỏ thay đổi',
    },
    noOrder: {
      action: 'Tháng này không cần đề nghị NCC',
      title: 'Tháng này không cần đề nghị NCC?',
      body: 'Tủ đã đủ cho mọi người đăng ký. Bước Gửi NCC và Nhận hàng sẽ tính là xong; cần thì vẫn lập phiếu lại được.',
      back: 'Hủy',
      ok: 'Xác nhận',
      failed: 'Chưa lưu được, thử lại sau.',
    },
    confirm: {
      title: 'Chốt phiếu gửi NCC?',
      replaceTitle: 'Bản mới thay thế bản in lúc {{time}}',
      changes: 'Đổi so với bản {{time}}:',
      change: '{{name}} {{x}} → {{y}}',
      more: 'và {{n}} món khác',
      back: 'Hủy',
    },
  },
};

export default sendAdm;
