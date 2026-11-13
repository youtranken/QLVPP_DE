const auth = {
  auth: {
    // Khung đăng nhập chung với QLTS/QLHS: dòng tên app dưới logo PMH, chân trang hỗ trợ
    appTagline: 'Văn phòng phẩm PMH',
    pmhLogoAlt: 'Phú Mỹ Hưng',
    help: 'Cần hỗ trợ? Liên hệ phòng Công nghệ thông tin.',
    copyright: '© {{year}} Phú Mỹ Hưng',
    heading: 'Đăng nhập',
    subtitle: 'Nhập email công ty để tiếp tục.',
    idLabel: 'Email công ty',
    idRequired: 'Chưa nhập email công ty.',
    submit: 'Đăng nhập',
    signingInAs: 'Đăng nhập với',
    changeId: 'Đổi',
    passwordPrompt: 'Nhập mật khẩu để đăng nhập.',
    saPassword: 'Mật khẩu',
    passwordRequired: 'Chưa nhập mật khẩu.',
    showPassword: 'Hiện mật khẩu',
    hidePassword: 'Ẩn mật khẩu',
    saInvalid: 'Sai tên tài khoản hoặc mật khẩu.',
    saLocked: 'Tạm khóa do nhập sai nhiều lần — thử lại sau 15 phút.',
    saError: 'Không đăng nhập được — thử lại sau ít phút.',
    loginFailed: 'Đăng nhập chưa thành công — bấm đăng nhập để thử lại.',
    ssoUnavailable: 'PMH ID tạm thời không liên lạc được. Quản trị kỹ thuật có thể đăng nhập bằng tài khoản nội bộ.',
    sessionExpired: 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.',
    ssoRedirecting: 'Đang chuyển sang PMH ID…',
    ssoManual: 'Không tự chuyển? Bấm vào đây.',
    logout: 'Đăng xuất',
    logoutFailed: 'Chưa đăng xuất được — thử lại.',
    testAccounts: {
      title: 'Tài khoản thử (chỉ bản dev)',
      hint: 'Dùng khi PMH ID bản dev chưa đăng nhập được. Không có trên bản chính thức.',
      username: 'Tên tài khoản thử',
      password: 'Mật khẩu tài khoản thử',
      submit: 'Đăng nhập tài khoản thử',
    },
    forbidden: {
      title: 'Tài khoản chưa được cấp quyền dùng VPP Công trình',
      body: 'Bạn đã đăng nhập PMH ID bằng {{email}}, nhưng PMH ID chưa cấp quyền vào VPP Công trình cho tài khoản này. Liên hệ {{admin_contact}} để được cấp quyền.',
      bodyNoEmail:
        'Bạn đã đăng nhập PMH ID, nhưng PMH ID chưa cấp quyền vào VPP Công trình cho tài khoản này. Liên hệ {{admin_contact}} để được cấp quyền.',
      defaultContact: 'Adm D&E',
      switchAccount: 'Đăng nhập bằng tài khoản khác',
      portal: 'Về trang PMH ID',
    },
  },
};

export default auth;
