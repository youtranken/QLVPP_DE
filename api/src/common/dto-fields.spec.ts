import { plainToInstance } from 'class-transformer';
import { Name, OptionalText } from './dto-fields';

class Named {
  @Name() name!: string;
  @OptionalText() name_en?: string | null;
}

const NFD_CAI = 'cái';

describe('Name / OptionalText — trim và chuẩn hóa NFC trước khi so trùng', () => {
  it('tên gõ dạng tổ hợp (NFD "cái") → lưu NFC "cái", bỏ khoảng trắng hai đầu', () => {
    const dto = plainToInstance(Named, {
      name: `  ${NFD_CAI} `,
      name_en: ` ${NFD_CAI} `,
    });
    expect(dto.name).toBe('cái');
    expect(dto.name_en).toBe('cái');
  });

  it('tên đã NFC giữ nguyên; chỉ khoảng trắng → OptionalText thành null', () => {
    const dto = plainToInstance(Named, { name: 'cái', name_en: '   ' });
    expect(dto.name).toBe('cái');
    expect(dto.name_en).toBeNull();
  });
});
