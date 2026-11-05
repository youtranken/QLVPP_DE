const sendAdm = {
  sendAdm: {
    title: 'Gửi ADM, kỳ tháng {{month}}',
    description: 'Phiếu đúng mẫu sheet phòng của ADM. In trình Chủ quản ký, rồi gửi Excel để ADM dán vào cột phòng.',
    unlocked: 'Kỳ tháng {{month}} chưa khóa sổ, mở lại sau {{deadline}}.',
    unlockedNoDate: 'Kỳ tháng {{month}} chưa khóa sổ.',
    actions: { print: 'In trình ký', xlsx: 'Xuất Excel mẫu phòng' },
    checklist: {
      title: 'Kiểm trước khi gửi',
      unregistered: '{{n}} người chưa đăng ký',
      unregisteredOk: 'Mọi người đã đăng ký',
      unregisteredLink: 'Tổng hợp kỳ',
      outside: '{{n}} món ngoài danh mục chưa duyệt',
      outsideOk: 'Không còn món ngoài danh mục chờ duyệt',
      outsideLink: 'Món ngoài danh mục',
      deducted: 'Đã trừ hàng trong tủ',
    },
    orders: {
      title: 'Số đề nghị',
      note: 'Bằng đăng ký cộng nợ, trừ tủ còn. Sửa nếu muốn xin dư; điền 0 để bỏ món khỏi phiếu.',
      label: 'Số đề nghị theo món',
      item: 'Món',
      need: 'Cần',
      stock: 'Tủ',
      qty: 'Đề nghị',
      qtyLabel: 'Đề nghị: {{name}}',
      invalid: 'Từ 0 đến 99 999.',
      outside: 'Ngoài danh mục',
      empty: 'Kỳ này chưa có món nào để đề nghị.',
    },
    preview: {
      label: 'Xem trước phiếu A4, tháng {{month}}/{{year}}',
    },
  },
};

export default sendAdm;
