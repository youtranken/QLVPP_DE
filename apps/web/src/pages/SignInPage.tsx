import { LoginOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { goToLogin } from '../lib/api';

/**
 * Trang đăng nhập (AUTH-1 AC1): **không có ô mật khẩu** — app không quản mật khẩu,
 * chỉ đẩy sang PMH ID.
 */
export function SignInPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const error = params.get('error');

  const errorMessage =
    error === 'phien_dang_nhap_het_han'
      ? t('auth.sessionExpired')
      : error
        ? t('auth.signInFailed')
        : null;

  return (
    <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 16 }}>
      <Card style={{ width: '100%', maxWidth: 400 }}>
        <Flex vertical gap={16}>
          <div>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              {t('common.appName')}
            </Typography.Title>
            <Typography.Text type="secondary">{t('auth.signInHint')}</Typography.Text>
          </div>

          {errorMessage && <Alert type="warning" showIcon message={errorMessage} />}

          {/* Không truyền returnTo: giữ nguyên trang mà RequireAuth đã ghi nhớ. */}
          <Button type="primary" size="large" icon={<LoginOutlined />} onClick={() => goToLogin()}>
            {t('auth.signIn')}
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
}
