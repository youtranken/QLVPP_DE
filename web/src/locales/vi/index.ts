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

const vi = { ...common, ...auth, ...nav, ...catalog, ...stock, ...admin, ...directory, ...profile, ...request, ...summary, ...review, ...notifications, ...delivery, ...reports };

export default vi;
