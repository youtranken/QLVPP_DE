import { Button, Result } from 'antd';
import { useTranslation } from 'react-i18next';
import { goToLogin } from '../lib/api';

/**
 * PMH ID trả `error=access_denied` (AUTH-3): giải thích rõ thay vì để văng trang lỗi.
 */
export function NoAccessPage() {
  const { t } = useTranslation();

  return (
    <Result
      status="403"
      title={t('auth.noAccessTitle')}
      subTitle={t('auth.noAccessBody')}
      extra={
        <Button type="primary" onClick={() => goToLogin('/')}>
          {t('auth.signIn')}
        </Button>
      }
    />
  );
}
