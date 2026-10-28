import common from './common';
import auth from './auth';
import nav from './nav';
import catalog from './catalog';
import stock from './stock';
import admin from './admin';
import profile from './profile';

const vi = { ...common, ...auth, ...nav, ...catalog, ...stock, ...admin, ...profile };

export default vi;
