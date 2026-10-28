import { ItemUsageRegistry } from './item-usage.hook';

describe('ItemUsageRegistry', () => {
  it('đăng ký cùng hook hai lần → ném lỗi thay vì kiểm hai lần', () => {
    const registry = new ItemUsageRegistry();
    const hook = { isUsed: () => Promise.resolve(false) };
    registry.register(hook);
    expect(() => registry.register(hook)).toThrow('đã đăng ký');
  });
});
