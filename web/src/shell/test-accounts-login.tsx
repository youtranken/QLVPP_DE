import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { testAccountLogin } from '@/lib/auth-actions';
import { fetchJson } from '@/lib/fetch-json';
import { SaLoginForm } from '@/shell/sa-login-form';

const LABELS = {
  username: 'auth.testAccounts.username',
  password: 'auth.testAccounts.password',
  submit: 'auth.testAccounts.submit',
};

// Chỉ hiện khi api bật LOCAL_TEST_ACCOUNTS (bản dev); lỗi/đang tải/tắt → không hiện gì
export function TestAccountsLogin() {
  const { t } = useTranslation();
  const config = useQuery({
    queryKey: ['auth-config'],
    queryFn: () => fetchJson<{ testAccounts?: boolean }>('/api/auth/config'),
    retry: false,
    staleTime: Infinity,
  });
  if (config.data?.testAccounts !== true) return null;
  return (
    <section className="login-test" aria-labelledby="login-test-title">
      <h3 id="login-test-title">{t('auth.testAccounts.title')}</h3>
      <p className="login-hint">{t('auth.testAccounts.hint')}</p>
      <SaLoginForm login={testAccountLogin} labels={LABELS} />
    </section>
  );
}
