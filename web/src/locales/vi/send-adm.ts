const sendAdm = {
  sendAdm: {
    actions: { print: 'In trình ký', xlsx: 'Xuất Excel mẫu phòng' },
    orders: {
      title: 'Số đề nghị',
      item: 'Món',
      registered: 'Đăng ký',
      backlog: 'Nợ tháng trước',
      stock: 'Tủ hiện có (tham khảo)',
      need: 'Tổng cần',
      qty: 'Đề nghị',
      qtyLabel: 'Đề nghị: {{name}}',
      invalid: 'Tối đa 99.999',
    },
    leave: {
      title: 'Bỏ số Đề nghị vừa sửa?',
      body: 'Bạn đã sửa {{n}} món nhưng chưa In trình ký. Rời trang sẽ mất các số này.',
      stay: 'Ở lại',
      discard: 'Bỏ thay đổi',
    },
    noOrder: {
      action: 'Tháng này không cần đề nghị ADM',
      title: 'Tháng này không cần đề nghị ADM?',
      body: 'Tủ đã đủ cho mọi người đăng ký. Bước Gửi ADM và Hàng về sẽ tính là xong; cần thì vẫn lập phiếu lại được.',
      back: 'Quay lại',
      ok: 'Xác nhận',
      failed: 'Chưa lưu được, thử lại sau.',
    },
    confirm: {
      title: 'Chốt phiếu gửi ADM?',
      replaceTitle: 'Bản mới thay thế bản in lúc {{time}}',
      changes: 'Đổi so với bản {{time}}:',
      change: '{{name}} {{x}} → {{y}}',
      more: 'và {{n}} món khác',
      review: 'Xem món ngoài danh mục',
      back: 'Quay lại',
    },
  },
};

export default sendAdm;
