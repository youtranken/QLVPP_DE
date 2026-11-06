const home = {
  home: {
    greeting: 'Chào {{name}}',
    stepsLabel: '4 bước của tháng',
    period: {
      label: 'Chọn kỳ',
      locked: 'Kỳ đang giao (tháng {{month}})',
      current: 'Kỳ đang đăng ký (tháng {{month}})',
    },
    hero: {
      titleStep: 'Kỳ tháng {{month}} đang ở bước {{step}}',
      titleDone: 'Kỳ tháng {{month}} đã xong',
      titleRegister: 'Kỳ tháng {{month}} đang nhận đăng ký',
      subDone: 'Cả 4 bước đã xong. Việc còn lại là đóng kỳ.',
      subRegister: 'Khóa tự động {{lock}}. Sau đó in phiếu gửi ADM.',
      sub: {
        register: 'Còn đang nhận đăng ký.',
        send: 'Kỳ đã khóa. In phiếu trình ký hoặc xuất Excel gửi ADM.',
        arrive: 'Nhập số lượng hàng ADM đã chia về để cộng vào tủ.',
        deliver: 'Hàng đã về. Giao cho từng người; phần chưa đủ hàng còn ở Chưa nhận.',
      },
    },
    step: {
      register: 'Đăng ký',
      send: 'Gửi ADM',
      arrive: 'Hàng về',
      deliver: 'Giao',
      later: 'Sau khi khóa sổ',
    },
    value: {
      register: '{{value}}',
      sendTodo: 'Chưa gửi',
      sent: 'Đã gửi {{time}} · {{x}} món, {{y}} đơn vị',
      noOrder: 'Không cần đề nghị ADM · {{time}}',
      noOrderArrive: 'Không có đơn gửi ADM',
      arriveTodo: '{{value}}',
      arriveDone: 'Đủ hàng',
      deliverTodo: '{{value}}',
      deliverDone: 'Đã giao hết',
      none: '—',
    },
    note: {
      registerOpen: 'Đang nhận đăng ký',
      registerDone: 'Đã khóa sổ',
      sendTodo: 'In trình ký, xuất Excel',
      arriveTodo: 'đơn vị còn chờ về',
      arriveDone: 'Không còn món thiếu',
      deliverTodo: 'dòng chờ giao',
      deliverDone: 'Không còn dòng chờ giao',
    },
    link: {
      viewSent: 'Xem bản đã gửi',
    },
    left: {
      action: 'Xử lý',
      debt: 'Xem nợ tháng trước',
    },
    cta: {
      register: 'Xem tổng hợp',
      send: 'Mở Gửi ADM',
      arrive: 'Nhập hàng về',
      deliver: 'Mở Giao hàng',
    },
    progress: '{{value}}% đã đăng ký',
    unregistered: {
      title: '{{n}} người chưa đăng ký kỳ tháng {{month}}',
      hint: 'Hạn 23:59 ngày {{day}}. Nhắc sớm để kịp gửi ADM.',
      more: 'và {{n}} người khác',
      copy: 'Chép tin nhắc',
      all: 'Xem tất cả',
    },
    custom: {
      title: '{{n}} món ngoài danh mục chờ xem',
      open: 'Xem món chờ duyệt',
    },
    low: {
      title: '{{n}} món trong tủ sắp hết',
      open: 'Xem tủ',
      stock: 'còn {{n}}',
    },
  },
};

export default home;
