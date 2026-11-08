import { SystemConfigService } from './system-config.service';

function serviceWithRows(rows: Array<{ value: unknown }>) {
  const where = jest.fn().mockResolvedValue(rows);
  const db = {
    select: jest.fn(() => ({ from: () => ({ where }) })),
  };
  return { service: new SystemConfigService(db as never), where };
}

describe('SystemConfigService.get', () => {
  it('đọc giá trị của khóa', async () => {
    const { service } = serviceWithRows([{ value: 20 }]);
    await expect(service.get('default_max_qty')).resolves.toBe(20);
  });

  it('cache 30 s — gọi lần hai không chạm DB', async () => {
    const { service, where } = serviceWithRows([{ value: 20 }]);
    await service.get('default_max_qty');
    await service.get('default_max_qty');
    expect(where).toHaveBeenCalledTimes(1);
  });

  it('đổi giá trị trong DB: 29 999 ms sau lần đọc vẫn giá trị cũ; đúng 30 000 ms → đọc lại giá trị mới', async () => {
    const where = jest
      .fn()
      .mockResolvedValueOnce([{ value: 20 }])
      .mockResolvedValueOnce([{ value: 30 }]);
    const db = { select: jest.fn(() => ({ from: () => ({ where }) })) };
    const service = new SystemConfigService(db as never);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      await expect(service.get('default_max_qty')).resolves.toBe(20);
      now.mockReturnValue(1_029_999);
      await expect(service.get('default_max_qty')).resolves.toBe(20);
      now.mockReturnValue(1_030_000);
      await expect(service.get('default_max_qty')).resolves.toBe(30);
      expect(where).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });

  it('thiếu khóa → throw nêu tên khóa', async () => {
    const { service } = serviceWithRows([]);
    await expect(service.get('default_max_qty')).rejects.toThrow(
      /default_max_qty/,
    );
  });
});
