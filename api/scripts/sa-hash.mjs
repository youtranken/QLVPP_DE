// Phân cách '.' thay '$' vì docker-compose diễn giải '$' là biến
import { randomBytes, scryptSync } from 'node:crypto';

const pw = process.argv[2];
if (!pw) {
  console.error("Cách dùng: npm run sa:hash -- '<mật-khẩu>'");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(pw, salt, 64);
console.log(`scrypt.${salt.toString('hex')}.${hash.toString('hex')}`);
