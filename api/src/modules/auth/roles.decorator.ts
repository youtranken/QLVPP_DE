import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'vpp:roles';

export type AppRole = 'member' | 'admin' | 'sa';

export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
