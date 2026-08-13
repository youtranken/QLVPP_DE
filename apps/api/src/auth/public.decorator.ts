import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'vpp:isPublic';

/** Đánh dấu route KHÔNG cần đăng nhập (health, luồng OIDC, webhook có chữ ký riêng). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);
