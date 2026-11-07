// Dùng chung cho SA (npm run sa:hash) và tài khoản thử dev (npm run local-test:hash).
// Phân cách '.' thay '$' vì docker-compose diễn giải '$' là biến
import { randomBytes, scryptSync } from 'node:crypto';

async function readPiped() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, '');
}

// Gõ tay trên terminal: tắt echo (raw mode) TRƯỚC khi nhắc — gõ ngay khi thấy lời nhắc mà echo còn bật thì lộ mật khẩu
function readHiddenFromTty() {
  process.stdin.setRawMode(true);
  process.stderr.write('Mật khẩu SA (không hiện chữ gõ, Enter để xong): ');
  process.stdin.setEncoding('utf8');
  return new Promise((resolve) => {
    let pw = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\u0003') {
          process.stdin.setRawMode(false);
          process.stderr.write('\n');
          process.exit(130);
        } else if (ch === '\r' || ch === '\n' || ch === '\u0004') {
          process.stdin.setRawMode(false);
          process.stdin.off('data', onData);
          process.stdin.pause();
          process.stderr.write('\n');
          resolve(pw);
          return;
        } else if (ch === '\u007f' || ch === '\b') {
          pw = pw.slice(0, -1);
        } else {
          pw += ch;
        }
      }
    };
    process.stdin.on('data', onData);
  });
}

// Không tham số thì đọc stdin để mật khẩu không nằm trong lịch sử shell
const pw =
  process.argv[2] ??
  (process.stdin.isTTY ? await readHiddenFromTty() : await readPiped());
if (!pw) {
  console.error(
    'Cách dùng: npm run -s sa:hash rồi gõ mật khẩu, hoặc printf \'%s\' "$PW" | npm run -s sa:hash',
  );
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(pw, salt, 64);
console.log(`scrypt.${salt.toString('hex')}.${hash.toString('hex')}`);
