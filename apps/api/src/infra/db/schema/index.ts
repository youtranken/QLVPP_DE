/**
 * Schema PostgreSQL (Drizzle) — theo SDD §5.
 * Tách theo miền: danh tính/phiên · danh mục · đơn đăng ký · thông báo & audit.
 */
export * from './identity';
export * from './catalog';
export * from './requests';
export * from './ops';
