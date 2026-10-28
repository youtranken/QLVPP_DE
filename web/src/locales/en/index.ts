import type vi from '@/locales/vi';
import type { Messages } from '@/locales/messages';
import common from './common';
import auth from './auth';
import nav from './nav';
import catalog from './catalog';
import stock from './stock';
import admin from './admin';
import profile from './profile';

const en: Messages<typeof vi> = { ...common, ...auth, ...nav, ...catalog, ...stock, ...admin, ...profile };

export default en;
