import common from './common';
import auth from './auth';
import nav from './nav';
import catalog from './catalog';
import stock from './stock';
import admin from './admin';
import directory from './directory';
import profile from './profile';
import request from './request';

const vi = { ...common, ...auth, ...nav, ...catalog, ...stock, ...admin, ...directory, ...profile, ...request };

export default vi;
