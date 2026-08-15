import { describe, expect, it } from 'vitest';
import { xemTruocNhap, type DanhMucHienCo } from './catalog-import.parser';

const TIEU_DE = ['Nhóm', 'Tên món', 'Đơn vị tính', 'Tối đa', 'Chỉ admin'];

const HIEN_CO: DanhMucHienCo = {
  categories: [
    { id: 'c1', name: 'Bút & Viết' },
    { id: 'c2', name: 'Giấy & Sổ' },
  ],
  items: [
    {
      id: 'i1',
      categoryId: 'c1',
      name: 'Bút bi xanh',
      code: 'BUT-001',
      unit: 'cây',
      maxQty: 20,
      adminOnly: false,
      active: true,
    },
    {
      id: 'i2',
      categoryId: 'c2',
      name: 'Sổ tay',
      code: null,
      unit: 'quyển',
      maxQty: 5,
      adminOnly: false,
      active: false,
    },
  ],
};

const chay = (hang: string[][]) => xemTruocNhap([TIEU_DE, ...hang], HIEN_CO);

describe('xemTruocNhap — tiêu đề', () => {
  it('nhận tiêu đề viết không dấu và khác hoa thường', () => {
    const kq = xemTruocNhap(
      [
        ['NHOM', 'ten mon', 'DON VI TINH'],
        ['Bút & Viết', 'Bút chì', 'cây'],
      ],
      HIEN_CO,
    );
    expect(kq.tomTat.them).toBe(1);
  });

  it('bỏ qua các dòng rác phía trên tiêu đề', () => {
    const kq = xemTruocNhap(
      [
        ['DANH MỤC VĂN PHÒNG PHẨM 2026', '', ''],
        [],
        TIEU_DE,
        ['Bút & Viết', 'Bút chì', 'cây', '', ''],
      ],
      HIEN_CO,
    );
    expect(kq.tomTat.them).toBe(1);
    expect(kq.dong[0].dong).toBe(4); // số dòng thật trong file
  });

  it('thiếu cột bắt buộc → ném lỗi rõ ràng', () => {
    expect(() =>
      xemTruocNhap(
        [
          ['Nhóm', 'Tên món'],
          ['x', 'y'],
        ],
        HIEN_CO,
      ),
    ).toThrow(/Đơn vị tính/);
  });

  it('không có tiêu đề → ném lỗi, KHÔNG đoán vị trí cột', () => {
    expect(() => xemTruocNhap([['a', 'b', 'c']], HIEN_CO)).toThrow(/tiêu đề/);
  });
});

describe('xemTruocNhap — phân loại từng dòng', () => {
  it('món mới trong nhóm đã có → thêm', () => {
    const kq = chay([['Bút & Viết', 'Bút chì 2B', 'cây', '10', '']]);
    expect(kq.dong[0]).toMatchObject({ hanhDong: 'them', toiDa: 10, chiAdmin: false });
  });

  it('món y hệt → không đổi', () => {
    const kq = chay([['Bút & Viết', 'Bút bi xanh', 'cây', '20', '']]);
    expect(kq.dong[0].hanhDong).toBe('khongDoi');
  });

  it('khác đơn vị/tối đa/cờ admin → cập nhật, và nói rõ đổi gì', () => {
    const kq = chay([['Bút & Viết', 'Bút bi xanh', 'hộp', '5', 'x']]);
    expect(kq.dong[0].hanhDong).toBe('capNhat');
    expect(kq.dong[0].ghiChu).toContain('cây → hộp');
    expect(kq.dong[0].ghiChu).toContain('20 → 5');
    expect(kq.dong[0].ghiChu).toContain('chỉ-admin');
  });

  it('món đang ngừng mà file vẫn có → bật lại, và BÁO RÕ', () => {
    const kq = chay([['Giấy & Sổ', 'Sổ tay', 'quyển', '5', '']]);
    expect(kq.dong[0].hanhDong).toBe('capNhat');
    expect(kq.dong[0].ghiChu).toContain('bật lại');
  });

  it('nhóm chưa có → thêm và ghi nhận nhóm mới', () => {
    const kq = chay([['Pin', 'Pin AA', 'viên', '', '']]);
    expect(kq.dong[0].hanhDong).toBe('them');
    expect(kq.nhomMoi).toEqual(['Pin']);
  });

  it('tên gõ thiếu dấu vẫn khớp món cũ, không tạo bản sao', () => {
    const kq = chay([['But & Viet', 'But bi xanh', 'cây', '20', '']]);
    expect(kq.dong[0].hanhDong).toBe('khongDoi');
    expect(kq.nhomMoi).toEqual([]);
  });
});

describe('xemTruocNhap — dòng hỏng', () => {
  it.each([
    ['thiếu nhóm', ['', 'Bút chì', 'cây', '', ''], /nhóm/i],
    ['thiếu tên', ['Bút & Viết', '', 'cây', '', ''], /tên món/i],
    ['thiếu đơn vị', ['Bút & Viết', 'Bút chì', '', '', ''], /đơn vị/i],
    ['tối đa là chữ', ['Bút & Viết', 'Bút chì', 'cây', 'nhiều', ''], /Tối đa/],
    ['tối đa bằng 0', ['Bút & Viết', 'Bút chì', 'cây', '0', ''], /Tối đa/],
    ['tối đa quá lớn', ['Bút & Viết', 'Bút chì', 'cây', '1000', ''], /Tối đa/],
    ['cờ admin lạ', ['Bút & Viết', 'Bút chì', 'cây', '', 'tùy'], /Chỉ admin/],
  ])('%s → lỗi', (_nhan, hang, mong) => {
    const kq = chay([hang]);
    expect(kq.dong[0].hanhDong).toBe('loi');
    expect(kq.dong[0].ghiChu).toMatch(mong);
    expect(kq.tomTat.loi).toBe(1);
  });

  it('trùng dòng trong cùng file → chỉ dòng sau bị lỗi', () => {
    const kq = chay([
      ['Bút & Viết', 'Bút chì', 'cây', '', ''],
      ['Bút & Viết', 'But chi', 'hộp', '', ''],
    ]);
    expect(kq.dong[0].hanhDong).toBe('them');
    expect(kq.dong[1].hanhDong).toBe('loi');
    expect(kq.dong[1].ghiChu).toContain('dòng 2');
  });

  it('trùng tên với nhiều món đang có → không tự đoán, báo lỗi', () => {
    const nhapNhang: DanhMucHienCo = {
      categories: [{ id: 'c1', name: 'Bút & Viết' }],
      items: [
        {
          id: 'a',
          categoryId: 'c1',
          name: 'Bút bi',
          code: null,
          unit: 'cây',
          maxQty: 20,
          adminOnly: false,
          active: true,
        },
        {
          id: 'b',
          categoryId: 'c1',
          name: 'But bi',
          code: null,
          unit: 'hộp',
          maxQty: 20,
          adminOnly: false,
          active: true,
        },
      ],
    };
    const kq = xemTruocNhap([TIEU_DE, ['Bút & Viết', 'Bút bi', 'cây', '', '']], nhapNhang);
    expect(kq.dong[0].hanhDong).toBe('loi');
    expect(kq.dong[0].ghiChu).toContain('nhiều món');
  });

  it('dòng trắng ở cuối file bị bỏ qua, không tính là lỗi', () => {
    const kq = chay([['Bút & Viết', 'Bút chì', 'cây', '', ''], ['', '', '', '', ''], []]);
    expect(kq.dong).toHaveLength(1);
    expect(kq.tomTat.loi).toBe(0);
  });
});

describe('xemTruocNhap — cột Mã', () => {
  const TIEU_DE_MA = ['Mã', 'Nhóm', 'Tên món', 'Đơn vị tính', 'Tối đa', 'Chỉ admin'];
  const chayMa = (hang: string[][]) => xemTruocNhap([TIEU_DE_MA, ...hang], HIEN_CO);

  it('gán mã cho món chưa có mã → cập nhật', () => {
    const kq = chayMa([['SO-001', 'Giấy & Sổ', 'Sổ tay', 'quyển', '5', '']]);
    expect(kq.dong[0].hanhDong).toBe('capNhat');
    expect(kq.dong[0].ghiChu).toContain('mã (trống) → SO-001');
  });

  it('mã y hệt (khác hoa thường vẫn tính là khác) ', () => {
    expect(
      chayMa([['BUT-001', 'Bút & Viết', 'Bút bi xanh', 'cây', '20', '']])['dong'][0].hanhDong,
    ).toBe('khongDoi');
  });

  it('gỡ mã khi ô để trống mà món đang có mã', () => {
    const kq = chayMa([['', 'Bút & Viết', 'Bút bi xanh', 'cây', '20', '']]);
    expect(kq.dong[0].hanhDong).toBe('capNhat');
    expect(kq.dong[0].ghiChu).toContain('gỡ mã');
  });

  it('file KHÔNG có cột Mã thì tuyệt đối không đụng mã đang có', () => {
    // Đây là bẫy chính: nhập một file cũ không có cột Mã mà lại xoá sạch mã.
    const kq = chay([['Bút & Viết', 'Bút bi xanh', 'cây', '20', '']]);
    expect(kq.dong[0].hanhDong).toBe('khongDoi');
    expect(kq.dong[0].ma).toBe('BUT-001');
  });

  it('mã trùng nhau trong cùng file → dòng sau báo lỗi', () => {
    const kq = chayMa([
      ['X-1', 'Bút & Viết', 'Bút chì', 'cây', '', ''],
      ['x-1', 'Bút & Viết', 'Bút lông', 'cây', '', ''],
    ]);
    expect(kq.dong[0].hanhDong).toBe('them');
    expect(kq.dong[1].hanhDong).toBe('loi');
    expect(kq.dong[1].ghiChu).toContain('trùng với dòng 2');
  });

  it('mã đang thuộc về món khác → báo lỗi thay vì gán đè', () => {
    const kq = chayMa([['but-001', 'Bút & Viết', 'Bút chì', 'cây', '', '']]);
    expect(kq.dong[0].hanhDong).toBe('loi');
    expect(kq.dong[0].ghiChu).toContain('đang được dùng cho món khác');
  });

  it('giữ nguyên mã của chính món đó thì không coi là trùng', () => {
    const kq = chayMa([['but-001', 'Bút & Viết', 'Bút bi xanh', 'cây', '20', '']]);
    expect(kq.dong[0].hanhDong).toBe('capNhat');
    expect(kq.dong[0].ghiChu).toContain('BUT-001 → but-001');
  });

  it.each([
    ['mã có khoảng trắng', 'BUT 001'],
    ['mã quá dài', 'A'.repeat(31)],
  ])('%s → lỗi', (_nhan, ma) => {
    const kq = chayMa([[ma, 'Bút & Viết', 'Bút chì', 'cây', '', '']]);
    expect(kq.dong[0].hanhDong).toBe('loi');
    expect(kq.dong[0].ghiChu).toContain('Mã món');
  });
});

describe('xemTruocNhap — tóm tắt', () => {
  it('đếm đúng từng loại', () => {
    const kq = chay([
      ['Bút & Viết', 'Bút bi xanh', 'cây', '20', ''], // khongDoi
      ['Bút & Viết', 'Bút chì', 'cây', '', ''], // them
      ['Giấy & Sổ', 'Sổ tay', 'quyển', '9', ''], // capNhat
      ['', '', '', '', 'x'], // loi
    ]);
    expect(kq.tomTat).toEqual({ them: 1, capNhat: 1, khongDoi: 1, loi: 1 });
  });
});
