import type vi from '@/locales/vi/auth';
import type { Messages } from '@/locales/messages';

const auth: Messages<typeof vi> = {
  auth: {
    // Khung đăng nhập chung với QLTS/QLHS: dòng tên app dưới logo PMH, chân trang IT Department · bản quyền
    appTagline: 'Office supplies management',
    pmhLogoAlt: 'Phu My Hung',
    copyright: '© {{year}} Phu My Hung · Division D&E',
    credit: 'Developed by IT Department',
    heading: 'Sign in',
    signInWithAccount: 'Sign in with D&E Account',
    idLabel: 'Email (optional, to prefill)',
    idInvalid: 'Invalid email.',
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
    loginFailed: 'Sign-in did not complete — press Continue to try again.',
    ssoUnavailable: 'Cannot reach D&E Account at the moment. Technical administrators can sign in with the internal account.',
    sessionExpired: 'Your session has expired. Sign in again to continue.',
    ssoRedirecting: 'Redirecting to D&E Account…',
    ssoManual: 'Not redirected? Click here.',
    logout: 'Sign out',
    testAccounts: {
      title: 'Test accounts (dev build only)',
      hint: 'For use while D&E Account sign-in does not work on dev. Not available in production.',
      username: 'Test account username',
      password: 'Test account password',
      submit: 'Sign in with test account',
    },
    forbidden: {
      title: 'No access',
      body: 'Your account does not have access to QLVPP. Contact D&E Admin for support.',
      switchAccount: 'Sign in with another account',
      portal: 'Back to D&E Account',
    },
  },
};

export default auth;
