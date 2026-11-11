/* Space Feedback form: the same form in every Space app.
   <script src="https://shovonix.dev/feedback/widget.js"></script>, then
   SpaceFeedback.open({ app: 'Space Cam', version: 'v1.8.4 beta' })
   Black and white; follows the app's light mode when <html data-theme="light">.
   Order: email → what kind → message (+ images/videos). "Love it" needs no message; Bug and Idea do. */
(function () {
  if (window.SpaceFeedback) return;
  var API = (document.currentScript && document.currentScript.src || '').replace(/\/widget\.js.*$/, '') || 'https://shovonix.dev/feedback';
  var MAX_MB = 100, MAX_FILES = 3;
  var ICON = {
    bug: '<svg viewBox="0 0 24 24"><path d="M8 2l1.9 1.9M16 2l-1.9 1.9M9 7.1V6a3 3 0 0 1 6 0v1.1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6zM12 20v-9M6.5 9C4.6 8.8 3 7.1 3 5M6 13H2M3 21c0-2.1 1.7-3.9 3.8-4M20.97 5c0 2.1-1.6 3.8-3.5 4M22 13h-4M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>',
    idea: '<svg viewBox="0 0 24 24"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5M9 18h6M10 22h4"/></svg>',
    love: '<svg viewBox="0 0 24 24"><path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/></svg>',
    clip: '<svg viewBox="0 0 24 24"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>'
  };
  var KINDS = {
    bug: { label: 'Bug', hint: 'Something broke', q: 'What went wrong?', ph: 'What you did, what you expected, and what happened instead.', need: true, send: 'Send bug report' },
    idea: { label: 'Idea', hint: 'Make it better', q: 'What’s your idea?', ph: 'What would you like it to do, and how would it help your shoots?', need: true, send: 'Send idea' },
    love: { label: 'Love it', hint: 'Say thanks', q: 'Anything you’d like to add?', ph: 'What you like most, or what you made with it.', need: false, send: 'Send love' }
  };
  var css = '' +
    '.sfb-wrap{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.78);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);padding:16px;font:14px/1.5 "Public Sans",system-ui,-apple-system,sans-serif;color:#f2f2f0;-webkit-font-smoothing:antialiased;animation:sfb-fade .18s ease-out}' +
    '@keyframes sfb-fade{from{opacity:0}}@keyframes sfb-up{from{opacity:0;transform:translateY(10px) scale(.98)}}' +
    '.sfb-card{position:relative;width:100%;max-width:460px;max-height:calc(100vh - 32px);overflow:auto;background:#1B1B1D;border:1px solid rgba(255,255,255,.18);border-radius:16px;box-shadow:0 0 0 1px rgba(0,0,0,.6),0 0 24px rgba(255,255,255,.05),0 30px 90px rgba(0,0,0,.75);padding:26px 26px 22px;animation:sfb-up .22s cubic-bezier(.2,.8,.2,1)}' +
    '.sfb-x{position:absolute;top:16px;right:16px;width:32px;height:32px;border-radius:50%;background:none;border:0;color:#8a8a90;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center}.sfb-x:hover{background:rgba(255,255,255,.07);color:#fff}' +
    '.sfb-title{font:700 21px/1.25 "Archivo",system-ui,sans-serif;margin:0 40px 4px 0;letter-spacing:-.01em}' +
    '.sfb-sub{color:#9a9aa0;font-size:13.5px;margin:0 0 20px}' +
    '.sfb-step{margin-bottom:18px}' +
    '.sfb-label{display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:13px;font-weight:600;color:#d8d8dc;margin:0 0 7px}' +
    '.sfb-opt{font-weight:500;color:#77777d;font-size:12px}' +
    '.sfb-in{width:100%;box-sizing:border-box;background:#0d0d0e;border:1px solid rgba(255,255,255,.12);border-radius:12px;color:#f2f2f0;font-size:14.5px;line-height:1.5;font-family:inherit;padding:11px 13px;outline:none;transition:border-color .15s,box-shadow .15s}' +
    '.sfb-in::placeholder{color:#5f5f65}' +
    '.sfb-in:focus{border-color:rgba(255,255,255,.4);box-shadow:0 0 0 4px rgba(255,255,255,.06)}' +
    '.sfb-in.sfb-need{border-color:rgba(255,255,255,.55);box-shadow:0 0 0 4px rgba(255,255,255,.08)}' +
    'textarea.sfb-in{min-height:104px;resize:vertical}' +
    '.sfb-tip{font-size:12.5px;color:#c8c8cc;margin-top:7px;display:none;align-items:center;gap:6px}.sfb-tip.on{display:flex}' +
    '.sfb-tip:before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;flex:none}' +
    '.sfb-kinds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
    '.sfb-kind{display:flex;flex-direction:column;align-items:flex-start;gap:7px;padding:12px 12px 11px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:#0d0d0e;color:#c8c8cc;font-family:inherit;cursor:pointer;text-align:left;transition:border-color .15s,background .15s,transform .1s}' +
    '.sfb-kind:hover{border-color:rgba(255,255,255,.25)}.sfb-kind:active{transform:scale(.98)}' +
    '.sfb-kind svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}' +
    '.sfb-kind b{font-size:13.5px;font-weight:700;color:#f2f2f0;line-height:1.2}' +
    '.sfb-kind small{font-size:11.5px;color:#7d7d83;line-height:1.3}' +
    '.sfb-kind.on{background:#f2f2f0;border-color:#f2f2f0;color:#0a0a0b}.sfb-kind.on b{color:#0a0a0b}.sfb-kind.on small{color:#55555a}' +
    '.sfb-more{overflow:hidden;transition:opacity .2s}' +
    '.sfb-files{display:flex;flex-direction:column;gap:6px;margin-top:8px}.sfb-files:empty{display:none}' +
    '.sfb-file{display:flex;align-items:center;gap:10px;background:#0d0d0e;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:6px 6px 6px 8px}' +
    '.sfb-thumb{width:46px;height:32px;border-radius:7px;object-fit:cover;background:#222;flex:none}' +
    '.sfb-fn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}' +
    '.sfb-fs{color:#7d7d83;font-size:12px;flex:none}' +
    '.sfb-file .sfb-rm{width:28px;height:28px;border-radius:50%;border:0;background:none;color:#8a8a90;cursor:pointer;flex:none}.sfb-file .sfb-rm:hover{background:rgba(255,255,255,.07);color:#fff}' +
    '.sfb-add{margin-top:8px;display:inline-flex;align-items:center;gap:7px;background:none;border:0;color:#a8a8ae;padding:4px 2px;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer}.sfb-add:hover{color:#fff}' +
    '.sfb-add svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}' +
    '.sfb-add small{font-weight:500;color:#66666c;font-size:12px}' +
    '.sfb-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:22px;padding-top:16px;border-top:1px solid rgba(255,255,255,.07)}' +
    '.sfb-meta{color:#66666c;font-size:11.5px;line-height:1.4}' +
    '.sfb-btn{flex:none;border-radius:12px;padding:11px 18px;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer;border:0;background:#f2f2f0;color:#0a0a0b;transition:transform .1s,opacity .15s}.sfb-btn:active{transform:scale(.98)}.sfb-btn:disabled{opacity:.55;cursor:default;transform:none}' +
    '.sfb-err{font-size:12.5px;color:#c8c8cc;margin-top:12px;display:none}.sfb-err.on{display:block}' +
    '.sfb-bar{height:3px;border-radius:2px;background:rgba(255,255,255,.08);margin-top:14px;overflow:hidden;display:none}.sfb-bar i{display:block;height:100%;width:0;background:#f2f2f0;transition:width .2s}' +
    '.sfb-done{text-align:center;padding:22px 6px 8px}' +
    '.sfb-done .sfb-ok{width:52px;height:52px;border-radius:50%;background:#f2f2f0;color:#0a0a0b;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}.sfb-done .sfb-ok svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}' +
    '.sfb-done b{display:block;font:700 20px "Archivo",system-ui,sans-serif;margin-bottom:6px}.sfb-done p{color:#9a9aa0;margin:0 0 20px}' +
    '.sfb-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
    /* light mode, when the app is in light mode */
    'html[data-theme="light"] .sfb-wrap{color:#111;background:rgba(0,0,0,.35)}' +
    'html[data-theme="light"] .sfb-card{background:#fff;border-color:rgba(0,0,0,.08);box-shadow:0 30px 80px rgba(0,0,0,.18)}' +
    'html[data-theme="light"] .sfb-label{color:#333}' +
    'html[data-theme="light"] .sfb-in,html[data-theme="light"] .sfb-file,html[data-theme="light"] .sfb-kind{background:#f6f6f5;border-color:rgba(0,0,0,.1);color:#111}' +
    'html[data-theme="light"] .sfb-in::placeholder{color:#a0a0a5}' +
    'html[data-theme="light"] .sfb-in:focus,html[data-theme="light"] .sfb-in.sfb-need{border-color:rgba(0,0,0,.45);box-shadow:0 0 0 4px rgba(0,0,0,.05)}' +
    'html[data-theme="light"] .sfb-kind{color:#444}html[data-theme="light"] .sfb-kind b{color:#111}' +
    'html[data-theme="light"] .sfb-kind.on,html[data-theme="light"] .sfb-btn,html[data-theme="light"] .sfb-done .sfb-ok{background:#111;border-color:#111;color:#fff}' +
    'html[data-theme="light"] .sfb-kind.on b{color:#fff}html[data-theme="light"] .sfb-kind.on small{color:#bbb}' +
    'html[data-theme="light"] .sfb-tip,html[data-theme="light"] .sfb-err{color:#333}' +
    'html[data-theme="light"] .sfb-add{color:#555}html[data-theme="light"] .sfb-add:hover,html[data-theme="light"] .sfb-x:hover{color:#000;background:rgba(0,0,0,.05)}' +
    'html[data-theme="light"] .sfb-foot{border-top-color:rgba(0,0,0,.07)}html[data-theme="light"] .sfb-bar{background:rgba(0,0,0,.08)}html[data-theme="light"] .sfb-bar i{background:#111}' +
    '@media (max-width:480px){.sfb-card{padding:22px 18px 18px;border-radius:18px}.sfb-kind small{display:none}.sfb-foot{flex-direction:column-reverse;align-items:stretch}.sfb-btn{width:100%}}';

  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k) || ''; localStorage.setItem(k, v); } catch (e) { return ''; } }
  function browser() {
    var ua = navigator.userAgent, b = /Edg\/(\d+)/.exec(ua) ? 'Edge ' + /Edg\/(\d+)/.exec(ua)[1] : /Chrome\/(\d+)/.exec(ua) ? 'Chrome ' + /Chrome\/(\d+)/.exec(ua)[1] : /Version\/(\d+).*Safari/.exec(ua) ? 'Safari ' + /Version\/(\d+)/.exec(ua)[1] : /Firefox\/(\d+)/.exec(ua) ? 'Firefox ' + /Firefox\/(\d+)/.exec(ua)[1] : 'Browser';
    var os = /Mac OS X/.test(ua) ? (navigator.maxTouchPoints > 1 ? 'iPad' : 'Mac') : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : 'Linux';
    return b + ' · ' + os;
  }
  function req(method, url, body, type, onProgress) {
    return new Promise(function (ok, fail) {
      var x = new XMLHttpRequest(); x.open(method, url);
      if (type) x.setRequestHeader('Content-Type', type);
      if (onProgress && x.upload) x.upload.onprogress = function (e) { if (e.lengthComputable) onProgress(e.loaded); };
      x.onload = function () { var j = {}; try { j = JSON.parse(x.responseText); } catch (e) {} if (x.status >= 200 && x.status < 300) ok(j); else fail(new Error(j.error || ('Something went wrong (' + x.status + '). Try again in a moment.'))); };
      x.onerror = function () { fail(new Error('Couldn’t reach the server. Check your internet and try again.')); };
      x.send(body);
    });
  }

  function open(opts) {
    opts = opts || {};
    if (!document.getElementById('sfb-style')) { var st = document.createElement('style'); st.id = 'sfb-style'; st.textContent = css; document.head.appendChild(st); }
    if (document.querySelector('.sfb-wrap')) return;
    var app = opts.app || document.title || 'Space app', files = [], kind = '', sending = false;
    var kindBtns = Object.keys(KINDS).map(function (k) { return '<button type="button" class="sfb-kind" data-k="' + k + '" aria-pressed="false">' + ICON[k] + '<b>' + KINDS[k].label + '</b><small>' + KINDS[k].hint + '</small></button>'; }).join('');
    var w = el('<div class="sfb-wrap"><div class="sfb-card" role="dialog" aria-modal="true" aria-labelledby="sfb-title">' +
      '<button type="button" class="sfb-x" aria-label="Close">✕</button>' +
      '<h2 class="sfb-title" id="sfb-title">How’s ' + esc(app) + ' working for you?</h2><p class="sfb-sub">Shovon reads every message himself.</p>' +
      '<form novalidate>' +
      '<div class="sfb-step"><label class="sfb-label" for="sfb-email">Your email</label><input id="sfb-email" class="sfb-in" type="email" autocomplete="email" placeholder="name@example.com" maxlength="254"><div class="sfb-tip" data-for="email">So Shovon can write back to you.</div></div>' +
      '<div class="sfb-step"><div class="sfb-label">What’s it about?</div><div class="sfb-kinds" role="group">' + kindBtns + '</div><div class="sfb-tip" data-for="kind">Pick one of these three.</div></div>' +
      '<div class="sfb-step sfb-more"><label class="sfb-label" for="sfb-msg"><span class="sfb-q">Tell Shovon more</span><span class="sfb-opt"></span></label><textarea id="sfb-msg" class="sfb-in" maxlength="5000" placeholder="Pick what it’s about first."></textarea><div class="sfb-tip" data-for="msg">A sentence or two is enough.</div>' +
      '<div class="sfb-files"></div><button type="button" class="sfb-add">' + ICON.clip + 'Add a screenshot or video <small>up to ' + MAX_FILES + ', ' + MAX_MB + ' MB each</small></button><input type="file" accept="image/*,video/*" multiple hidden></div>' +
      '<input class="sfb-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="sfb-bar"><i></i></div><div class="sfb-err" role="alert"></div>' +
      '<div class="sfb-foot"><div class="sfb-meta">Also sent: ' + esc(app + (opts.version ? ' ' + opts.version : '')) + '<br>' + esc(browser()) + '</div><button type="submit" class="sfb-btn sfb-send">Send</button></div>' +
      '</form></div></div>');
    var q = function (s) { return w.querySelector(s); };
    var msg = q('#sfb-msg'), email = q('#sfb-email'), err = q('.sfb-err'), input = q('input[type=file]'), list = q('.sfb-files'), bar = q('.sfb-bar'), sendBtn = q('.sfb-send');
    var tip = function (k, on) { q('.sfb-tip[data-for="' + k + '"]').classList.toggle('on', on); };
    email.value = store('spaceFeedback.email');
    function close() { if (sending) return; files.forEach(function (f) { if (f.url) URL.revokeObjectURL(f.url); }); w.remove(); document.removeEventListener('keydown', onKey, true); if (opts.onClose) opts.onClose(); }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } else e.stopPropagation(); }
    document.addEventListener('keydown', onKey, true); // keeps app shortcuts (Space, R…) from firing while typing
    w.addEventListener('mousedown', function (e) { if (e.target === w) close(); });
    q('.sfb-x').onclick = close;
    function setKind(k) {
      kind = k; var K = KINDS[k]; tip('kind', false);
      Array.prototype.forEach.call(w.querySelectorAll('.sfb-kind'), function (o) { var on = o.dataset.k === k; o.classList.toggle('on', on); o.setAttribute('aria-pressed', on); });
      q('.sfb-q').textContent = K.q; q('.sfb-opt').textContent = K.need ? '' : 'optional';
      msg.placeholder = K.ph; sendBtn.textContent = K.send;
      if (!K.need) { tip('msg', false); msg.classList.remove('sfb-need'); }
    }
    Array.prototype.forEach.call(w.querySelectorAll('.sfb-kind'), function (b) { b.onclick = function () { setKind(b.dataset.k); if (KINDS[b.dataset.k].need) msg.focus(); }; });
    email.oninput = function () { tip('email', false); email.classList.remove('sfb-need'); };
    msg.oninput = function () { if (msg.value.trim()) { tip('msg', false); msg.classList.remove('sfb-need'); } };
    function renderFiles() {
      list.innerHTML = '';
      files.forEach(function (f, i) {
        var row = el('<div class="sfb-file">' + (f.url ? (/^video/.test(f.file.type) ? '<video class="sfb-thumb" muted></video>' : '<img class="sfb-thumb" alt="">') : '<span class="sfb-thumb"></span>') + '<span class="sfb-fn"></span><span class="sfb-fs">' + mb(f.file.size) + '</span><button type="button" class="sfb-rm" aria-label="Remove">✕</button></div>');
        var th = row.querySelector('.sfb-thumb'); if (f.url) th.src = f.url;
        row.querySelector('.sfb-fn').textContent = f.file.name;
        row.querySelector('.sfb-rm').onclick = function () { if (sending) return; if (f.url) URL.revokeObjectURL(f.url); files.splice(i, 1); renderFiles(); };
        list.appendChild(row);
      });
      q('.sfb-add').style.display = files.length >= MAX_FILES ? 'none' : '';
    }
    q('.sfb-add').onclick = function () { input.click(); };
    input.onchange = function () {
      err.classList.remove('on');
      Array.prototype.forEach.call(input.files, function (f) {
        if (files.length >= MAX_FILES) { err.textContent = 'You can add up to ' + MAX_FILES + ' files.'; err.classList.add('on'); return; }
        if (f.size > MAX_MB * 1048576) { err.textContent = f.name + ' is bigger than ' + MAX_MB + ' MB. A shorter clip works fine.'; err.classList.add('on'); return; }
        files.push({ file: f, url: /^(image|video)\//.test(f.type) ? URL.createObjectURL(f) : '' });
      });
      input.value = ''; renderFiles();
    };
    q('form').onsubmit = function (e) {
      e.preventDefault(); if (sending) return; err.classList.remove('on');
      var text = msg.value.trim(), mail = email.value.trim(), first = null;
      ['email', 'kind', 'msg'].forEach(function (k) { tip(k, false); }); email.classList.remove('sfb-need'); msg.classList.remove('sfb-need');
      if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(mail)) { tip('email', true); email.classList.add('sfb-need'); first = first || email; }
      if (!kind) { tip('kind', true); first = first || q('.sfb-kind'); }
      else if (KINDS[kind].need && !text) { tip('msg', true); msg.classList.add('sfb-need'); first = first || msg; }
      if (first) { first.focus(); return; }
      store('spaceFeedback.email', mail);
      sending = true; sendBtn.disabled = true; sendBtn.textContent = 'Sending…';
      var total = files.reduce(function (n, f) { return n + f.file.size; }, 0), doneBytes = 0;
      if (total) bar.style.display = 'block';
      var setBar = function (n) { bar.firstChild.style.width = Math.min(100, Math.round(n / total * 100)) + '%'; };
      req('POST', API + '/api/send', JSON.stringify({ app: app, version: opts.version || '', page: location.origin + location.pathname, kind: kind, message: text, email: mail, website: q('.sfb-hp').value, files: files.map(function (f) { return { name: f.file.name, size: f.file.size, type: f.file.type }; }) }), 'application/json')
        .then(function (r) {
          var chain = Promise.resolve();
          files.forEach(function (f, i) {
            chain = chain.then(function () {
              sendBtn.textContent = 'Uploading ' + (i + 1) + ' of ' + files.length + '…';
              return req('PUT', API + '/api/file/' + r.id + '/' + i + '?token=' + r.token, f.file, 'application/octet-stream', function (n) { setBar(doneBytes + n); })
                .then(function () { doneBytes += f.file.size; setBar(doneBytes); });
            });
          });
          return chain.then(function () { if (files.length) return req('POST', API + '/api/done/' + r.id + '?token=' + r.token, '', 'text/plain'); });
        })
        .then(function () {
          sending = false;
          var head = kind === 'love' ? 'That made Shovon’s day.' : kind === 'idea' ? 'Thanks for the idea.' : 'Thanks, Shovon’s on it.';
          q('.sfb-card').innerHTML = '<div class="sfb-done"><div class="sfb-ok">' + ICON.check + '</div><b>' + head + '</b><p>' + (kind === 'love' ? 'Thanks for taking a moment to say it.' : 'If he has a question, he’ll write to ' + esc(mail) + '.') + '</p><button type="button" class="sfb-btn">Close</button></div>';
          q('.sfb-done button').onclick = close; q('.sfb-done button').focus();
        })
        .catch(function (e2) { sending = false; sendBtn.disabled = false; sendBtn.textContent = KINDS[kind].send; bar.style.display = 'none'; err.textContent = e2.message || 'Something went wrong. Try again.'; err.classList.add('on'); });
    };
    document.body.appendChild(w); (email.value ? q('.sfb-kind') : email).focus();
  }
  window.SpaceFeedback = { open: open };
})();
