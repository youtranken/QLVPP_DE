import type vi from '@/locales/vi';
import type { Messages } from '@/locales/messages';
import common from './common';
import auth from './auth';
import nav from './nav';
import catalog from './catalog';
import stock from './stock';
import admin from './admin';
import directory from './directory';
import profile from './profile';
import request from './request';
import summary from './summary';
import review from './review';
import notifications from './notifications';
import delivery from './delivery';
import reports from './reports';
import units from './units';
import config from './config';
import arrivals from './arrivals';
import sendAdm from './send-adm';
import month from './month';
import warnings from './warnings';

const en: Messages<typeof vi> = { ...common, ...auth, ...nav, ...catalog, ...stock, ...admin, ...directory, ...profile, ...request, ...summary, ...review, ...notifications, ...delivery, ...reports, ...units, ...config, ...arrivals, ...sendAdm, ...month, ...warnings };

export default en;
