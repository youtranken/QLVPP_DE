import type vi from '@/locales/vi/auth';
import type { Messages } from '@/locales/messages';

const auth: Messages<typeof vi> = {
  auth: {
    brand: 'Phu My Hung · Construction Dept.',
    brandBadge: 'PMH',
    heroTitle: 'Order office supplies every month',
    heroBody: 'Pick items, set quantities, save your request. D&E Admin collects, buys and delivers to your desk.',
    heading: 'Sign in',
    primary: 'Sign in with your company account (PMH ID)',
    primaryHint: 'You will be taken to the company sign-in page and brought back here.',
    hintToggle: 'Suggest an account (optional)',
    hintLabel: 'Company email',
    hintPlaceholder: 'name.surname@pmh.com.vn',
    hintSubmit: 'Continue with PMH ID',
    itToggle: 'For IT',
    saUsername: 'Username',
    saPassword: 'Password',
    saSubmit: 'Sign in',
    saInvalid: 'Wrong username or password.',
    saLocked: 'Temporarily locked after too many failed attempts — try again in 15 minutes.',
    saError: 'Could not sign in — try again in a few minutes.',
    loginFailed: 'Sign-in did not complete — press sign in to try again.',
    ssoUnavailable: 'PMH ID is temporarily unreachable. Technical administrators can sign in with the internal account.',
    sessionExpired: 'Your session has expired — sign in again to continue.',
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
