// Phân cách '.' thay '$' vì docker-compose diễn giải '$' là biến
import { randomBytes, scryptSync } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Không tham số thì đọc stdin để mật khẩu không nằm trong lịch sử shell
const pw = process.argv[2] ?? readFileSync(0, 'utf8').replace(/\r?\n$/, '');
if (!pw) {
  console.error(
    "Cách dùng: read -rsp 'Mật khẩu SA: ' PW; echo; printf '%s' \"$PW\" | npm run -s sa:hash; unset PW",
  );
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(pw, salt, 64);
console.log(`scrypt.${salt.toString('hex')}.${hash.toString('hex')}`);
