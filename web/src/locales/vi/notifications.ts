const notifications = {
  notifications: {
    title: 'Thông báo',
    bell: 'Thông báo, {{count}} chưa đọc',
    markAllRead: 'Đánh dấu đã đọc tất cả',
    empty: 'Chưa có thông báo',
    loadMore: 'Xem thêm',
    markError: 'Chưa đánh dấu đã đọc được — thử lại.',
    loadError: 'Không tải được thông báo — thử lại.',
    someone: 'Một người',
    unreadMark: 'Chưa đọc',
    month: 'tháng {{month}}',
    topics: {
      period_open: 'Kỳ đăng ký {{month}} đã mở, hạn đăng ký đến hết {{deadline}}.',
      reminder: 'Bạn chưa đăng ký {{month}} — hạn đăng ký đến hết {{deadline}}.',
      period_locked: 'Kỳ {{month}} đã khóa: {{registered}}/{{headcount}} người đã đăng ký.',
      low_stock: '{{name}} sắp hết kho, còn {{stock_qty}}.',
      request_delivered: 'Phiếu {{month}} của bạn đã được giao đủ.',
      line_cancelled: 'Hành chính hủy phần còn nợ {{qty}} {{unit}} {{name}} ({{month}}): {{reason}}',
      custom_line_new: '{{person}} thêm món ngoài danh mục "{{name}}" ({{month}}).',
      line_review: {
        accepted: 'Hành chính đã chấp nhận món "{{name}}" ({{month}}).',
        acceptedNote: 'Hành chính đã chấp nhận món "{{name}}" ({{month}}): {{note}}',
        converted: 'Món "{{name}}" ({{month}}) đã được thêm vào danh mục thành {{item}}.',
        rejected: 'Hành chính từ chối món "{{name}}" ({{month}}).',
        rejectedNote: 'Hành chính từ chối món "{{name}}" ({{month}}): {{note}}',
      },
      unknown: 'Bạn có thông báo mới.',
    },
  },
};

export default notifications;
