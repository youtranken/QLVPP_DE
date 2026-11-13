import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchJson } from '@/lib/fetch-json';
import { switchAccount } from '@/lib/auth-actions';
import { portalUrl } from '@/lib/pmh-portal';
import { IconLock } from '@/ui/icons';
import { LanguageSwitch } from '@/ui/language-switch';
import { AuthFrame } from '@/shell/auth-frame';

// Cùng khung đăng nhập (ảnh tòa nhà + cột kem) như QLTS: bị chặn quyền vẫn ở "cửa vào", có lối đổi tài khoản / về PMH ID
export function ForbiddenScreen({ email }: { email?: string | null }) {
  const { t } = useTranslation();
  const config = useQuery({
    queryKey: ['public-config'],
    queryFn: () => fetchJson<{ admin_contact: string }>('/api/public-config'),
  });
  const adminContact = config.data?.admin_contact?.trim() || t('auth.forbidden.defaultContact');
  return (
    <AuthFrame>
      <div className="auth-card__head">
        <span className="auth-ic" aria-hidden="true">
          <IconLock />
        </span>
        <LanguageSwitch short className="seg--sm" />
      </div>
      <h1>{t('auth.forbidden.title')}</h1>
      {/* Đang tải liên hệ: giữ chỗ bằng câu với liên hệ mặc định (ẩn) để nút bên dưới không bị đẩy khi câu thật hiện ra */}
      <p className={`auth-card__body${config.isPending ? ' is-pending' : ''}`} aria-busy={config.isPending}>
        {email
          ? t('auth.forbidden.body', { email, admin_contact: adminContact })
          : t('auth.forbidden.bodyNoEmail', { admin_contact: adminContact })}
      </p>
      <div className="auth-actions">
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={switchAccount}>
          {t('auth.forbidden.switchAccount')}
        </button>
        <a className="btn btn--lg btn--block" href={portalUrl()}>
          {t('auth.forbidden.portal')}
        </a>
      </div>
    </AuthFrame>
  );
}
