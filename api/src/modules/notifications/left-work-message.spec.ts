import { leftWorkLink, leftWorkMail } from './left-work-message';
import type { LeftWorkParams } from './left-work-message';

const base: LeftWorkParams = {
  name: 'Nguyễn Văn A',
  reason: 'locked',
  owed_lines: 3,
  owed_months: 2,
  pending_lines: 1,
  open_request: true,
};

describe('leftWorkLink', () => {
  it('còn nợ → Giao hàng mở sẵn người đó; chỉ chờ duyệt → Duyệt món', () => {
    expect(leftWorkLink('a b/c', base)).toBe(
      '/admin/delivery?person=a%20b%2Fc',
    );
    expect(leftWorkLink('s', { ...base, owed_lines: 0, owed_months: 0 })).toBe(
      '/admin/review',
    );
  });
});

describe('leftWorkMail', () => {
  it('vi + en: ai, vì sao, giữ gì, phiếu kỳ mở, link tuyệt đối', () => {
    const m = leftWorkMail(
      base,
      '/admin/delivery?person=s',
      'https://vpp.test/',
    );
    expect(m.subject).toBe(
      '[VPP] Nguyễn Văn A bị khoá nhưng còn việc dở / was locked with pending work',
    );
    expect(m.text).toContain(
      'Nguyễn Văn A bị khoá nhưng còn 3 món chưa nhận (2 tháng), 1 món ngoài danh mục chờ duyệt. Có phiếu kỳ đang mở.',
    );
    expect(m.text).toContain(
      'Nguyễn Văn A was locked but still has 3 undelivered items (2 months), 1 off-catalog item awaiting review. Has a request in the open period.',
    );
    expect(m.text).toContain('https://vpp.test/admin/delivery?person=s');
  });

  it('lý do xoá / mất quyền; phần trống không in', () => {
    const m = leftWorkMail(
      {
        ...base,
        reason: 'no_access',
        owed_lines: 0,
        owed_months: 0,
        open_request: false,
      },
      '/admin/review',
      '',
    );
    expect(m.text).toContain(
      'Nguyễn Văn A mất quyền vào VPP nhưng còn 1 món ngoài danh mục chờ duyệt.',
    );
    expect(m.text).toContain('lost access to VPP');
    expect(m.text).not.toContain('kỳ đang mở');
    expect(m.text).toContain('Xem: /admin/review');
    expect(
      leftWorkMail({ ...base, reason: 'deleted' }, '/x', '').subject,
    ).toContain('bị xoá');
  });
});
