import { useTranslation } from 'react-i18next';
import { MemberPage } from '@/shell/member-page';
import { AccountContent } from './account-content';

export function ProfilePage() {
  const { t } = useTranslation();
  return (
    <MemberPage title={t('profile.title')}>
      <section className="pf-card">
        <AccountContent />
      </section>
    </MemberPage>
  );
}
