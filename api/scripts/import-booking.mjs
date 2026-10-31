import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { drizzle } = require('drizzle-orm/node-postgres');
const pg = require('pg');
const dist = (m) => require(`../dist/modules/catalog/${m}.js`);
const { readBookingRows } = dist('booking-sheet');
const { parseBookingRows } = dist('booking-import');
const { applyBookingImport } = dist('booking-apply');
const { formatBookingReport } = dist('booking-report');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const files = args.filter((a) => a !== '--apply');
if (files.length !== 1 || files[0].startsWith('--')) {
  console.error(
    'Cách dùng: node scripts/import-booking.mjs <file.xlsx> [--apply]',
  );
  process.exit(2);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Thiếu DATABASE_URL.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
try {
  const parsed = parseBookingRows(await readBookingRows(files[0]));
  const result = await applyBookingImport(drizzle(pool), parsed, { apply });
  console.log(formatBookingReport(result));
} finally {
  await pool.end();
}
