'use strict';
// Space Feedback: one feedback inbox for every Space app (Space Cam, Space Prompter, …).
// - Apps load /feedback/widget.js and call SpaceFeedback.open({ app, version }): same form everywhere.
// - Each submission is saved under DATA_DIR/<id>/ (meta.json + attached images/videos) and emailed to MAIL_TO.
// - /feedback/ is the private inbox: one password (ADMIN_PASS_HASH), nobody else can read it.
// Node 18+, no dependencies. Runs behind nginx: location ^~ /feedback/ → http://127.0.0.1:8788
const http = require('http'), fs = require('fs'), fsp = fs.promises, path = require('path'), crypto = require('crypto'), tls = require('tls');

// .env next to this file (local testing); on the VPS systemd's EnvironmentFile sets the same names
try { for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
const env = k => process.env[k] || '';
const PORT = +env('PORT') || 8788, HOST = env('HOST') || '127.0.0.1';
const BASE = env('BASE_PATH') || '/feedback';
const PUBLIC_URL = env('PUBLIC_URL') || 'https://shovonix.dev/feedback';
const PUBLIC_ORIGIN = new URL(PUBLIC_URL).origin;
const DATA = env('DATA_DIR') || path.join(__dirname, 'data');
const ORIGINS = env('ALLOWED_ORIGINS').split(',').map(s => s.trim()).filter(Boolean);
const SUBDOMAIN = /^https:\/\/([a-z0-9-]+\.)*shovonix\.dev$/;
const MAX_FILE = (+env('MAX_FILE_MB') || 100) * 1048576, MAX_FILES = 3, MAX_MSG = 5000;
const SECURE_COOKIE = PUBLIC_URL.startsWith('https:');
const PASS_HASH = env('ADMIN_PASS_HASH');
fs.mkdirSync(DATA, { recursive: true });
const SECRET = env('SESSION_SECRET') || (() => { const f = path.join(DATA, '.secret'); try { return fs.readFileSync(f, 'utf8'); } catch { const s = crypto.randomBytes(32).toString('hex'); fs.writeFileSync(f, s, { mode: 0o600 }); return s; } })();

const originOk = o => !!o && (ORIGINS.includes(o) || SUBDOMAIN.test(o));
const ID_RE = /^\d{8}-\d{6}-[a-z0-9]{6}$/;
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i;
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n).trim();
const safeName = n => (clip(n, 200).replace(/[\/\\]/g, '_').replace(/[^\w.\- ()]+/g, '_').replace(/^\.+/, '') || 'file').slice(-80);
const TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', avif: 'image/avif', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', txt: 'text/plain', log: 'text/plain', pdf: 'application/pdf' };
const typeOf = n => TYPES[(n.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
const INLINE = /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|quicktime|webm)|audio\/)/;

// ---- small helpers ----
const send = (res, code, body, headers = {}) => { res.writeHead(code, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', ...headers }); res.end(body); };
const json = (res, code, obj, headers = {}) => send(res, code, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', ...headers });
const readBody = (req, limit) => new Promise((resolve, reject) => { let n = 0; const parts = []; req.on('data', c => { n += c.length; if (n > limit) { reject(Object.assign(new Error('too big'), { code: 413 })); req.destroy(); } else parts.push(c); }); req.on('end', () => resolve(Buffer.concat(parts).toString('utf8'))); req.on('error', reject); });
const ipOf = req => (req.headers['x-real-ip'] || req.socket.remoteAddress || '').toString();
const metaPath = id => path.join(DATA, id, 'meta.json');
const readMeta = async id => JSON.parse(await fsp.readFile(metaPath(id), 'utf8'));
const writeMeta = async m => { const f = metaPath(m.id); await fsp.writeFile(f + '.tmp', JSON.stringify(m, null, 1)); await fsp.rename(f + '.tmp', f); };
const newId = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}-${crypto.randomBytes(4).toString('hex').slice(0, 6)}`; };
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

// rate limits (in memory, per IP)
const hits = new Map();
const limited = (key, max, ms) => { const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < ms); arr.push(now); hits.set(key, arr); return arr.length > max; };
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.some(t => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

// upload tokens: given with a new submission, needed for its files and "done"
const tokens = new Map(); // id → { token, timer }

// ---- admin session ----
const checkPass = pw => {
  const m = PASS_HASH.match(/^scrypt\$([0-9a-f]+)\$([0-9a-f]+)$/); if (!m) return false;
  const got = crypto.scryptSync(String(pw), Buffer.from(m[1], 'hex'), 64);
  return crypto.timingSafeEqual(got, Buffer.from(m[2], 'hex'));
};
const sign = v => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
const sessionCookie = () => { const exp = Date.now() + 30 * 864e5, v = exp + '.' + sign(String(exp)); return `fbs=${v}; Path=${BASE}; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${SECURE_COOKIE ? '; Secure' : ''}`; };
const authed = req => { const m = (req.headers.cookie || '').match(/(?:^|;\s*)fbs=(\d+)\.([0-9a-f]{64})/); return !!m && +m[1] > Date.now() && eq(sign(m[1]), m[2]); };
// state-changing admin calls: same-site page + custom header (a form on another site can't add it)
const adminWrite = req => authed(req) && req.headers['x-fb'] === '1' && (!req.headers.origin || req.headers.origin === PUBLIC_ORIGIN);

// ---- email (SMTP over TLS, e.g. Gmail with an app password) ----
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const encWord = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`;
function mail({ subject, text, replyTo }) {
  const host = env('SMTP_HOST'), user = env('SMTP_USER'), pass = env('SMTP_PASS'), to = env('MAIL_TO') || user;
  if (!host || !user || !pass) { console.log('[mail not set up] would send:', subject); return Promise.resolve(false); }
  const from = env('MAIL_FROM') || user;
  const msg = [
    `From: ${encWord('Space feedback')} <${from}>`, `To: <${to}>`, replyTo ? `Reply-To: <${replyTo}>` : null,
    `Subject: ${encWord(subject)}`, `Date: ${new Date().toUTCString()}`, `Message-ID: <${crypto.randomUUID()}@shovonix.dev>`,
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', '',
    b64(text).replace(/.{1,76}/g, '$&\r\n').trimEnd()
  ].filter(l => l !== null).join('\r\n');
  const steps = [[null, 220], ['EHLO shovonix.dev', 250], ['AUTH LOGIN', 334], [b64(user), 334], [b64(pass), 235], [`MAIL FROM:<${from}>`, 250], [`RCPT TO:<${to}>`, 250], ['DATA', 354], [msg + '\r\n.', 250], ['QUIT', 221]];
  return new Promise((resolve, reject) => {
    const s = tls.connect(+env('SMTP_PORT') || 465, host, { servername: host }); s.setEncoding('utf8');
    s.setTimeout(20000, () => s.destroy(new Error('SMTP timeout')));
    let buf = '', i = 0;
    s.on('data', d => {
      buf += d; const m = buf.match(/(?:^|\r\n)(\d{3}) [^\r\n]*\r\n$/); if (!m) return;
      const code = +m[1]; buf = '';
      if (code !== steps[i][1]) { s.destroy(); return reject(new Error(`SMTP ${code} at step ${i}`)); }
      if (++i >= steps.length) { s.end(); return resolve(true); }
      s.write(steps[i][0] + '\r\n');
    });
    s.on('error', reject);
  });
}
const KIND = { bug: 'Bug', idea: 'Idea', love: 'Love it', other: 'Feedback' };
const finishing = new Set();
async function finish(id) {
  const t = tokens.get(id); if (t) { clearTimeout(t.timer); tokens.delete(id); }
  if (finishing.has(id)) return; finishing.add(id);
  try { await finishOne(id); } finally { finishing.delete(id); }
}
async function finishOne(id) {
  let m; try { m = await readMeta(id); } catch { return; }
  if (m.mailed) return;
  const files = m.files.filter(f => f.done).map(f => `- ${f.name} (${f.size >= 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.size / 1024)) + ' KB'})`);
  const missing = m.files.filter(f => !f.done).length;
  const text = [
    `${m.app}${m.version ? ' ' + m.version : ''} · ${KIND[m.kind] || 'Feedback'}`, '',
    m.message || '(no message)', '',
    `From: ${m.email || '(no email)'}`,
    files.length ? `Attached:\n${files.join('\n')}` : null,
    missing ? `${missing} file(s) didn't finish uploading.` : null,
    `Browser: ${m.ua || '?'}`, m.page ? `Page: ${m.page}` : null, '',
    `Open in the inbox: ${PUBLIC_URL}/#${m.id}`, m.email ? 'Reply to this email to answer them.' : null
  ].filter(l => l !== null).join('\n');
  const first = (m.message || '').split('\n')[0].slice(0, 60);
  try { m.mailed = await mail({ subject: `[${m.app}] ${KIND[m.kind] || 'Feedback'}${first ? ': ' + first : ''}`, text, replyTo: m.email }); }
  catch (e) { console.error('mail failed', id, e.message); m.mailError = e.message; }
  await writeMeta(m).catch(() => {});
}

// ---- routes ----
async function handle(req, res) {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === BASE) return send(res, 301, '', { Location: BASE + '/' });
  if (!u.pathname.startsWith(BASE + '/')) return send(res, 404, 'Not found');
  const p = u.pathname.slice(BASE.length), method = req.method, origin = req.headers.origin;
  const cors = originOk(origin) ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' } : {};

  // public: the form script, and the API it uses
  if (p === '/widget.js' && (method === 'GET' || method === 'HEAD')) {
    return send(res, 200, await fsp.readFile(path.join(__dirname, 'widget.js')), { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Access-Control-Allow-Origin': '*' });
  }
  if (p.startsWith('/api/') && method === 'OPTIONS') {
    if (!cors['Access-Control-Allow-Origin']) return send(res, 403, '');
    return send(res, 204, '', { ...cors, 'Access-Control-Allow-Methods': 'POST, PUT', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
  }
  if (p === '/api/send' && method === 'POST') {
    if (!originOk(origin)) return json(res, 403, { error: 'origin' });
    if (limited('send:' + ipOf(req), 8, 3600e3)) return json(res, 429, { error: 'Too many in an hour. Try again later.' }, cors);
    let b; try { b = JSON.parse(await readBody(req, 64 * 1024)); } catch { return json(res, 400, { error: 'bad request' }, cors); }
    if (b.website) return json(res, 200, { id: 'x', token: 'x', files: [] }, cors); // honeypot: bots fill the hidden field
    const message = clip(b.message, MAX_MSG), email = clip(b.email, 254), files = Array.isArray(b.files) ? b.files.slice(0, MAX_FILES) : [];
    if (!message && !files.length && b.kind !== 'love') return json(res, 400, { error: 'Write a few words or attach a file.' }, cors); // "Love it" may be sent with no words
    if (!EMAIL_RE.test(email)) return json(res, 400, { error: 'Add your email so Shovon can reply.' }, cors);
    if (files.some(f => !(+f.size > 0) || +f.size > MAX_FILE)) return json(res, 400, { error: `Each file can be up to ${MAX_FILE / 1048576} MB.` }, cors);
    const id = newId(), token = crypto.randomBytes(18).toString('hex');
    await fsp.mkdir(path.join(DATA, id));
    const m = {
      id, at: new Date().toISOString(), app: clip(b.app, 40) || 'Unknown app', version: clip(b.version, 40), origin,
      page: clip(b.page, 300), kind: KIND[b.kind] ? b.kind : 'other', message, email, ua: clip(req.headers['user-agent'], 300),
      files: files.map((f, i) => ({ name: safeName(f.name), file: `${i}-${safeName(f.name)}`, type: typeOf(safeName(f.name)), size: +f.size, done: false })),
      status: 'new'
    };
    await writeMeta(m);
    // email goes out once the files are in (or after 30 min, with whatever arrived)
    tokens.set(id, { token, timer: setTimeout(() => finish(id), m.files.length ? 30 * 60e3 : 50) });
    return json(res, 200, { id, token, files: m.files.map(f => f.name) }, cors);
  }
  let r;
  if ((r = p.match(/^\/api\/file\/([\w-]+)\/(\d)$/)) && method === 'PUT') {
    const [, id, idx] = r; const t = tokens.get(id);
    if (!ID_RE.test(id) || !t || !eq(t.token, u.searchParams.get('token') || '')) return json(res, 403, { error: 'expired' }, cors);
    const m = await readMeta(id), f = m.files[+idx]; if (!f || f.done) return json(res, 400, { error: 'bad file' }, cors);
    const target = path.join(DATA, id, f.file); let n = 0, over = false;
    const out = fs.createWriteStream(target);
    req.on('data', c => { n += c.length; if (n > f.size || n > MAX_FILE) { over = true; req.destroy(); out.destroy(); } });
    req.pipe(out);
    await new Promise(ok => { out.on('close', ok); req.on('close', () => { if (over || !req.complete) out.destroy(); }); });
    if (over || n !== f.size) { await fsp.rm(target, { force: true }); return json(res, 400, { error: 'upload broke off' }, cors); }
    const m2 = await readMeta(id); m2.files[+idx].done = true; await writeMeta(m2);
    return json(res, 200, { ok: true }, cors);
  }
  if ((r = p.match(/^\/api\/done\/([\w-]+)$/)) && method === 'POST') {
    const [, id] = r; const t = tokens.get(id);
    if (!ID_RE.test(id) || !t || !eq(t.token, u.searchParams.get('token') || '')) return json(res, 403, { error: 'expired' }, cors);
    finish(id);
    return json(res, 200, { ok: true }, cors);
  }

  // private inbox
  if (p === '/inbox.js' && method === 'GET') return send(res, 200, await fsp.readFile(path.join(__dirname, 'inbox.js')), { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
  const page = async name => send(res, 200, await fsp.readFile(path.join(__dirname, name)), { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'; form-action 'self'", 'Referrer-Policy': 'same-origin' });
  if (p === '/' && method === 'GET') return page(authed(req) ? 'inbox.html' : 'login.html');
  if (p === '/login' && method === 'POST') {
    const ip = ipOf(req);
    if (limited('login:' + ip, 6, 15 * 60e3)) return send(res, 303, '', { Location: BASE + '/?wait' });
    const pw = new URLSearchParams(await readBody(req, 4096).catch(() => '')).get('password') || '';
    if (!PASS_HASH || !checkPass(pw)) return send(res, 303, '', { Location: BASE + '/?wrong' });
    hits.delete('login:' + ip);
    return send(res, 303, '', { Location: BASE + '/', 'Set-Cookie': sessionCookie() });
  }
  if (p === '/logout' && method === 'POST') return send(res, 303, '', { Location: BASE + '/', 'Set-Cookie': `fbs=; Path=${BASE}; HttpOnly; SameSite=Lax; Max-Age=0${SECURE_COOKIE ? '; Secure' : ''}` });
  if (!authed(req)) return json(res, 401, { error: 'login' });

  if (p === '/api/list' && method === 'GET') {
    const ids = (await fsp.readdir(DATA)).filter(x => ID_RE.test(x)).sort().reverse();
    const items = []; for (const id of ids) { try { items.push(await readMeta(id)); } catch {} }
    return json(res, 200, { items, mailReady: !!(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS')) });
  }
  if ((r = p.match(/^\/api\/item\/([\w-]+)$/)) && ID_RE.test(r[1])) {
    if (!adminWrite(req)) return json(res, 403, { error: 'forbidden' });
    if (method === 'DELETE') { await fsp.rm(path.join(DATA, r[1]), { recursive: true, force: true }); return json(res, 200, { ok: true }); }
    if (method === 'POST') {
      const b = JSON.parse(await readBody(req, 1024) || '{}'); const m = await readMeta(r[1]);
      if (['new', 'read', 'done'].includes(b.status)) m.status = b.status;
      await writeMeta(m); return json(res, 200, { ok: true });
    }
  }
  if ((r = p.match(/^\/file\/([\w-]+)\/(\d)$/)) && method === 'GET' && ID_RE.test(r[1])) {
    const m = await readMeta(r[1]), f = m.files[+r[2]]; if (!f || !f.done) return send(res, 404, 'Not found');
    const file = path.join(DATA, r[1], f.file), size = (await fsp.stat(file)).size;
    const head = { 'Content-Type': f.type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Content-Disposition': `${INLINE.test(f.type) && !u.searchParams.has('dl') ? 'inline' : 'attachment'}; filename="${f.name.replace(/"/g, '')}"` };
    const range = (req.headers.range || '').match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      let start = range[1] ? +range[1] : size - +range[2], end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      if (start > end || start >= size) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
      res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { ...head, 'Content-Length': size }); return fs.createReadStream(file).pipe(res);
  }
  return send(res, 404, 'Not found');
}

http.createServer((req, res) => handle(req, res).catch(e => { console.error(e); if (!res.headersSent) json(res, e.code === 413 ? 413 : 500, { error: e.code === 413 ? 'too big' : 'server error' }); else res.end(); }))
  .listen(PORT, HOST, () => console.log(`Space Feedback on http://${HOST}:${PORT}${BASE}/  data: ${DATA}  password ${PASS_HASH ? 'set' : 'NOT set (run: node set-password.js)'}`));
