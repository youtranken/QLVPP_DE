import { intersectsCI } from './group-access';

export type UserRole = 'admin' | 'member';

export function resolveRole(groups: string[], adminGroup: string): UserRole {
  return intersectsCI(groups, [adminGroup]) ? 'admin' : 'member';
}
