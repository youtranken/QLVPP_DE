import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Khung các màn "vào hệ thống" — cùng bố cục trang đăng nhập QLTS/QLHS (và PMH ID): ảnh tòa nhà bên trái,
 * cột nền kem bên phải có logo PMH, dòng tên app, thẻ viền vàng trên đỉnh và chân trang hỗ trợ.
 * Điện thoại (≤ 900px) ẩn ảnh, chỉ còn cột phải. Kích thước ảnh khai sẵn (width/height + object-fit) để không nhảy bố cục.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="auth">
      <div className="auth-media" aria-hidden="true">
        <img src="/login-bg.webp" alt="" width={2048} height={1169} />
      </div>
      <div className="auth-panel">
        <header className="auth-panel-head">
          <img className="auth-pmh-logo" src="/logo-pmh-on-light.png" alt={t('auth.pmhLogoAlt')} width={383} height={274} />
          <p className="auth-panel-name">
            <i aria-hidden="true">{t('app.logoLetter')}</i>
            <span>
              {t('app.title')} — {t('auth.appTagline')}
            </span>
          </p>
        </header>
        <div className="auth-panel-body">
          <main className="auth-card">{children}</main>
        </div>
        <footer className="auth-panel-foot">
          <span>{t('auth.copyright', { year: new Date().getFullYear() })}</span>
          <span>{t('auth.credit')}</span>
          <span className="auth-panel-foot__help">{t('auth.help')}</span>
        </footer>
      </div>
    </div>
  );
}
