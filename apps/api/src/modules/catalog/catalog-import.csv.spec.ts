import { describe, expect, it } from 'vitest';
import { docCsv } from './catalog-import.service';

describe('docCsv', () => {
  it('tách theo dấu phẩy', () => {
    expect(docCsv('Nhóm,Tên món\nBút,Bút bi')).toEqual([
      ['Nhóm', 'Tên món'],
      ['Bút', 'Bút bi'],
    ]);
  });

  it('tự nhận file dùng dấu chấm phẩy (Excel bản tiếng Việt)', () => {
    expect(docCsv('Nhóm;Tên món;ĐVT\nBút;Bút bi;cây')).toEqual([
      ['Nhóm', 'Tên món', 'ĐVT'],
      ['Bút', 'Bút bi', 'cây'],
    ]);
  });

  it('file dùng phẩy: chấm phẩy trong tên món KHÔNG bị cắt cột', () => {
    expect(docCsv('Nhóm,Tên món\nBút,"Bút bi; loại tốt"')).toEqual([
      ['Nhóm', 'Tên món'],
      ['Bút', 'Bút bi; loại tốt'],
    ]);
  });

  it('giữ dấu phẩy nằm trong ô bọc nháy kép', () => {
    expect(docCsv('a,b\n"x, y",z')).toEqual([
      ['a', 'b'],
      ['x, y', 'z'],
    ]);
  });

  it('nháy kép lồng viết dạng ""', () => {
    expect(docCsv('a\n"Giấy ""A4"""')).toEqual([['a'], ['Giấy "A4"']]);
  });

  it('bỏ BOM của Excel Windows để tiêu đề cột đầu không bị hỏng', () => {
    expect(docCsv('\uFEFFNhóm,Tên món')[0][0]).toBe('Nhóm');
  });

  it('chịu được xuống dòng kiểu Windows', () => {
    expect(docCsv('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('giữ xuống dòng nằm trong ô', () => {
    expect(docCsv('a,b\n"dòng 1\ndòng 2",z')).toEqual([
      ['a', 'b'],
      ['dòng 1\ndòng 2', 'z'],
    ]);
  });
});
