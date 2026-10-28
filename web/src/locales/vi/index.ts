import common from './common';
import auth from './auth';
import nav from './nav';
import catalog from './catalog';
import stock from './stock';
import admin from './admin';
import directory from './directory';
import profile from './profile';

const vi = { ...common, ...auth, ...nav, ...catalog, ...stock, ...admin, ...directory, ...profile };

export default vi;
