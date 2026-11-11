// Makes the inbox password line. Run: node set-password.js
// Type the password (not shown), then put the printed ADMIN_PASS_HASH=… line into the env file and restart.
const crypto = require('crypto');
const ask = q => new Promise(resolve => {
  process.stdout.write(q); let s = '';
  const stdin = process.stdin; stdin.setRawMode?.(true); stdin.resume(); stdin.setEncoding('utf8');
  const on = chunk => { for (const c of chunk) {
    if (c === '\r' || c === '\n' || c === '\u0004') { stdin.setRawMode?.(false); stdin.pause(); stdin.off('data', on); process.stdout.write('\n'); return resolve(s); }
    else if (c === '\u0003') process.exit(1);
    else if (c === '\u007f') s = s.slice(0, -1);
    else s += c;
  } };
  stdin.on('data', on);
});
(async () => {
  const a = await ask('New inbox password: '), b = await ask('Again: ');
  if (a !== b) { console.error('They don’t match.'); process.exit(1); }
  if (a.length < 10) { console.error('Use at least 10 characters.'); process.exit(1); }
  const salt = crypto.randomBytes(16);
  console.log(`ADMIN_PASS_HASH=scrypt$${salt.toString('hex')}$${crypto.scryptSync(a, salt, 64).toString('hex')}`);
})();
