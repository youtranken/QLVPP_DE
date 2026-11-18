import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { switchAccount } from '@/lib/auth-actions';
import { fetchPublicConfig, portalFallback } from '@/lib/pmh-portal';
import { IconLock } from '@/ui/icons';
import { LanguageSwitch } from '@/ui/language-switch';
import { AuthFrame } from '@/shell/auth-frame';

// Cùng khung đăng nhập (ảnh tòa nhà + cột kem) như QLTS: bị chặn quyền vẫn ở "cửa vào", có lối đổi tài khoản / về PMH ID
export function ForbiddenScreen() {
  const { t } = useTranslation();
  const config = useQuery({
    queryKey: ['public-config'],
    queryFn: fetchPublicConfig,
  });
  // Cổng PMH ID của đúng môi trường (theo issuer); chưa tải / lỗi / server không cấu hình → suy từ host của VPP
  const portal = config.data?.pmh_portal_url || portalFallback();
  return (
    <AuthFrame>
      <div className="auth-card__head">
        <span className="auth-ic" aria-hidden="true">
          <IconLock />
        </span>
        <LanguageSwitch short className="seg--sm" />
      </div>
      <h1>{t('auth.forbidden.title')}</h1>
      <p className="auth-card__body">{t('auth.forbidden.body')}</p>
      <div className="auth-actions">
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={switchAccount}>
          {t('auth.forbidden.switchAccount')}
        </button>
        <a className="btn btn--lg btn--block" href={portal}>
          {t('auth.forbidden.portal')}
        </a>
      </div>
    </AuthFrame>
  );
}
