import { describe, expect, it } from 'vitest';
import { selectOrphans, type StoredFile } from './orphan-selector';

const NOW = new Date('2026-08-14T10:00:00+07:00').getTime();
const GIO = 60 * 60 * 1000;
const AN_HAN = 24 * GIO;

const file = (name: string, tuoiGio: number): StoredFile => ({
  name,
  modifiedAt: NOW - tuoiGio * GIO,
});

const A = '11111111-1111-4111-8111-111111111111.png';
const B = '22222222-2222-4222-8222-222222222222.jpg';
const C = '33333333-3333-4333-8333-333333333333.webp';

describe('selectOrphans', () => {
  const run = (files: StoredFile[], referencedPaths: string[] = []) =>
    selectOrphans({ files, referencedPaths, now: NOW, graceMs: AN_HAN });

  it('xoá file cũ không ai tham chiếu', () => {
    expect(run([file(A, 48)]).remove).toEqual([A]);
  });

  it('GIỮ file đang được món trong danh mục tham chiếu', () => {
    expect(run([file(A, 48)], [`/api/uploads/${A}`]).remove).toEqual([]);
  });

  it('GIỮ file đang được dòng đơn tham chiếu', () => {
    expect(run([file(B, 999)], [`/api/uploads/${B}`]).remove).toEqual([]);
  });

  it('GIỮ file vừa tải lên dù chưa ai tham chiếu — form có thể đang mở dở', () => {
    const result = run([file(A, 1)]);
    expect(result.remove).toEqual([]);
    expect(result.keptInGrace).toBe(1);
  });

  it('đúng ngưỡng ân hạn thì đã được xoá', () => {
    expect(run([file(A, 24)]).remove).toEqual([A]);
    expect(run([file(A, 23.9)]).remove).toEqual([]);
  });

  it('KHÔNG đụng file không đúng khuôn server sinh', () => {
    const laFile = [
      file('.gitkeep', 999),
      file('anh-quan-trong.png', 999),
      file('11111111-1111-4111-8111-111111111111.exe', 999),
      file('../../etc/passwd', 999),
    ];
    expect(run(laFile).remove).toEqual([]);
  });

  it('so khớp theo TÊN FILE nên không phụ thuộc tiền tố đường dẫn', () => {
    // Đường dẫn lưu trong CSDL có thể đổi tiền tố về sau; khớp theo tên file thì
    // đổi tiền tố không biến ảnh đang dùng thành "mồ côi" rồi bị xoá oan.
    expect(run([file(A, 99)], [`/uploads/${A}`]).remove).toEqual([]);
  });

  it('bỏ qua tham chiếu rỗng/null', () => {
    expect(run([file(A, 99)], ['', null as unknown as string]).remove).toEqual([A]);
  });

  it('xử lý hỗn hợp: giữ cái đang dùng, giữ cái mới, xoá cái cũ vô chủ', () => {
    const result = run([file(A, 99), file(B, 2), file(C, 99)], [`/api/uploads/${A}`]);
    expect(result.remove).toEqual([C]);
    expect(result.keptInGrace).toBe(1);
  });
});
