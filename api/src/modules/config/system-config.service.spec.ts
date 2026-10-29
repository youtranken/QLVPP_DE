import { SystemConfigService } from './system-config.service';

function serviceWithRows(rows: Array<{ value: unknown }>) {
  const where = jest.fn().mockResolvedValue(rows);
  const db = {
    select: jest.fn(() => ({ from: () => ({ where }) })),
  };
  return { service: new SystemConfigService(db as never), where };
}

describe('SystemConfigService.getAdminGroup', () => {
  it('đọc config.admin_group', async () => {
    const { service } = serviceWithRows([{ value: 'vpp-admin' }]);
    await expect(service.getAdminGroup()).resolves.toBe('vpp-admin');
  });

  it('cache 30 s — gọi lần hai không chạm DB', async () => {
    const { service, where } = serviceWithRows([{ value: 'vpp-admin' }]);
    await service.getAdminGroup();
    await service.getAdminGroup();
    expect(where).toHaveBeenCalledTimes(1);
  });

  it('đổi admin_group trong DB: 29 999 ms sau lần đọc vẫn giá trị cũ; đúng 30 000 ms → đọc lại giá trị mới', async () => {
    const where = jest
      .fn()
      .mockResolvedValueOnce([{ value: 'vpp-admin' }])
      .mockResolvedValueOnce([{ value: 'nhom-moi' }]);
    const db = { select: jest.fn(() => ({ from: () => ({ where }) })) };
    const service = new SystemConfigService(db as never);
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
    try {
      await expect(service.getAdminGroup()).resolves.toBe('vpp-admin');
      now.mockReturnValue(1_029_999);
      await expect(service.getAdminGroup()).resolves.toBe('vpp-admin');
      now.mockReturnValue(1_030_000);
      await expect(service.getAdminGroup()).resolves.toBe('nhom-moi');
      expect(where).toHaveBeenCalledTimes(2);
    } finally {
      now.mockRestore();
    }
  });

  it.each([42, '', '   ', null])(
    'giá trị %p không phải chuỗi khác rỗng → throw',
    async (value) => {
      const { service } = serviceWithRows([{ value }]);
      await expect(service.getAdminGroup()).rejects.toThrow(/admin_group/);
    },
  );

  it('thiếu khóa → throw', async () => {
    const { service } = serviceWithRows([]);
    await expect(service.getAdminGroup()).rejects.toThrow(/admin_group/);
  });
});
