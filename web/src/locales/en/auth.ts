import type vi from '@/locales/vi/auth';
import type { Messages } from '@/locales/messages';

const auth: Messages<typeof vi> = {
  auth: {
    // Khung đăng nhập chung với QLTS/QLHS: dòng tên app dưới logo PMH, chân trang hỗ trợ
    appTagline: 'PMH office supplies',
    pmhLogoAlt: 'Phu My Hung',
    help: 'Need help? Contact the IT department.',
    copyright: '© {{year}} Phú Mỹ Hưng',
    heading: 'Sign in',
    subtitle: 'Enter your company email to continue.',
    idLabel: 'Company email',
    idRequired: 'Enter your company email.',
    submit: 'Sign in',
    signingInAs: 'Signing in as',
    changeId: 'Change',
    passwordPrompt: 'Enter your password to sign in.',
    saPassword: 'Password',
    passwordRequired: 'Enter your password.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    saInvalid: 'Wrong username or password.',
    saLocked: 'Temporarily locked after too many failed attempts — try again in 15 minutes.',
    saError: 'Could not sign in — try again in a few minutes.',
    loginFailed: 'Sign-in did not complete — press sign in to try again.',
    ssoUnavailable: 'PMH ID is temporarily unreachable. Technical administrators can sign in with the internal account.',
    sessionExpired: 'Your session has expired. Sign in again to continue.',
    ssoRedirecting: 'Redirecting to PMH ID…',
    ssoManual: 'Not redirected? Click here.',
    logout: 'Sign out',
    logoutFailed: 'Could not sign out — try again.',
    testAccounts: {
      title: 'Test accounts (dev build only)',
      hint: 'For use while PMH ID on dev cannot sign anyone in. Not available in production.',
      username: 'Test account username',
      password: 'Test account password',
      submit: 'Sign in with test account',
    },
    forbidden: {
      title: 'This account is not allowed to use VPP Construction yet',
      body: 'You signed in to PMH ID as {{email}}, but PMH ID has not granted this account access to VPP Construction. Contact {{admin_contact}} to be granted access.',
      bodyNoEmail:
        'You signed in to PMH ID, but PMH ID has not granted this account access to VPP Construction. Contact {{admin_contact}} to be granted access.',
      defaultContact: 'D&E Admin',
      switchAccount: 'Sign in with another account',
      portal: 'Back to PMH ID',
    },
  },
};

export default auth;
