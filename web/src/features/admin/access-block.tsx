import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { FormField } from '@/ui/form-field';
import { useDirectoryUsers } from '@/features/directory/use-all-users';
import type { AdminUser } from '@/features/directory/directory.api';
import type { AccessDraft } from './config-form';
import { ConfigSection } from './config-section';
import type { ConfigBlockState } from './use-config-block';

// So khớp không phân biệt hoa thường, như group-access.ts ở api
const membersOf = (users: AdminUser[], group: string) => {
  const g = group.trim().toLowerCase();
  return users.filter((u) => u.groups.some((x) => x.toLowerCase() === g));
};

export function AccessBlock({ state, authorizedGroups }: { state: ConfigBlockState<AccessDraft>; authorizedGroups: string[] }) {
  const { t } = useTranslation();
  const me = useMe();
  const directory = useDirectoryUsers('');
  const ready = !directory.loading && !directory.failed && !directory.overflow;
  const members = ready ? membersOf(directory.users, state.draft.admin_group) : null;
  const lockout = members !== null && me.role === 'admin' && state.draft.admin_group.trim() !== '' && !members.some((u) => u.sub === me.sub);

  return (
    <ConfigSection title={t('config.access.title')} saveLabel={t('config.access.save')} state={state}>
      <FormField label={t('config.access.adminGroup')} hint={t('config.access.adminGroupHint')} error={state.errors.admin_group ? t(state.errors.admin_group) : undefined}>
        {(p) => (
          <input
            {...p}
            maxLength={200}
            value={state.draft.admin_group}
            onChange={(e) => state.update(() => ({ admin_group: e.target.value }), 'admin_group')}
          />
        )}
      </FormField>
      {members !== null && <p className="cf-count">{t('config.access.members', { count: members.length })}</p>}
      {!directory.loading && members === null && <p className="ff-hint">{t('config.access.membersUnknown')}</p>}
      {lockout && members && <p className="alert alert--warn">{t(members.length === 0 ? 'config.access.selfLockout' : 'config.access.selfLockoutNotMember', { name: me.fullName || t('config.access.you') })}</p>}
      <AuthorizedGroups groups={authorizedGroups} users={ready ? directory.users : null} />
    </ConfigSection>
  );
}

// Chỉ đồng bộ danh bạ ghi được khóa này (server từ chối khi PUT), nên chỉ hiện để đọc
function AuthorizedGroups({ groups, users }: { groups: string[]; users: AdminUser[] | null }) {
  const { t } = useTranslation();
  const labelId = useId();
  return (
    <div className="cf-readonly">
      <span id={labelId} className="ff-label">
        {t('config.access.authorizedGroups')}
      </span>
      {groups.length > 0 ? (
        <ul className="cf-tags" aria-labelledby={labelId}>
          {groups.map((g) => (
            <li key={g} className="tag">
              {users ? t('config.access.groupCount', { group: g, count: membersOf(users, g).length }) : g}
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('config.access.noGroups')}</p>
      )}
      <p className="ff-hint">
        {t('config.access.authorizedGroupsHint')} <Link to="/admin/users">{t('config.access.openDirectory')}</Link>
      </p>
    </div>
  );
}
