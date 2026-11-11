// Feedback inbox (private): lists every submission from every Space app, newest first.
(function () {
  // login page: show why the last try failed
  if (!document.getElementById('list')) {
    if (/[?&]wrong/.test(location.search)) document.getElementById('wrong').classList.add('on');
    if (/[?&]wait/.test(location.search)) document.getElementById('wait').classList.add('on');
    return;
  }
  var items = [], filter = 'All';
  var $ = function (id) { return document.getElementById(id); };
  var KIND = { bug: 'Bug', idea: 'Idea', love: 'Love it', other: 'Feedback' };
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function when(iso) {
    var d = new Date(iso), s = (Date.now() - d) / 1000;
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  function api(method, url, body) {
    return fetch(url, { method: method, headers: { 'X-FB': '1', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' })
      .then(function (r) { if (r.status === 401) { location.reload(); throw new Error('login'); } return r.json(); });
  }
  function setStatus(it, status) { it.status = status; render(); api('POST', 'api/item/' + it.id, { status: status }); }
  function render() {
    var apps = {}; items.forEach(function (i) { apps[i.app] = (apps[i.app] || 0) + 1; });
    var newCount = items.filter(function (i) { return i.status === 'new'; }).length;
    $('count').textContent = items.length ? items.length + ' total' + (newCount ? ' · ' + newCount + ' new' : '') : 'Nothing yet';
    var f = $('filters'); f.innerHTML = '';
    ['All'].concat(Object.keys(apps).sort()).forEach(function (a) {
      var b = h('button', 'chip' + (a === filter ? ' on' : ''), a); b.appendChild(h('span', 'n', String(a === 'All' ? items.length : apps[a])));
      b.onclick = function () { filter = a; render(); }; f.appendChild(b);
    });
    var list = $('list'); list.innerHTML = '';
    var shown = items.filter(function (i) { return filter === 'All' || i.app === filter; });
    if (!shown.length) { list.appendChild(h('div', 'empty-all', 'No feedback yet. It shows up here, and in your email, as soon as someone sends it.')); return; }
    shown.forEach(function (it) {
      var card = h('article', 'item ' + it.status); card.id = it.id;
      var top = h('div', 'top');
      if (it.status === 'new') top.appendChild(h('span', 'dot'));
      top.appendChild(h('span', 'app', it.app + (it.version ? ' ' + it.version : '')));
      top.appendChild(h('span', 'kind ' + it.kind, KIND[it.kind] || 'Feedback'));
      var w = h('span', 'when', when(it.at)); w.title = new Date(it.at).toString(); top.appendChild(w);
      card.appendChild(top);
      card.appendChild(h('p', 'msg' + (it.message ? '' : ' empty'), it.message || (it.kind === 'love' ? 'Sent love, no words.' : '(no message)')));
      if (it.files.length) {
        var fs = h('div', 'files');
        it.files.forEach(function (f, i) {
          var url = 'file/' + it.id + '/' + i, box = h('div', 'f');
          if (!f.done) { fs.appendChild(h('span', 'missing', f.name + ' (upload didn’t finish)')); return; }
          fs.appendChild(box); var fsOuter = fs; fs = box;
          if (/^image\/(png|jpeg|gif|webp|avif)/.test(f.type)) { var im = h('img'); im.src = url; im.alt = f.name; im.loading = 'lazy'; im.onclick = function () { var z = h('div', 'zoom'); var zi = h('img'); zi.src = url; z.appendChild(zi); z.onclick = function () { z.remove(); }; document.body.appendChild(z); }; fs.appendChild(im); }
          else if (/^video\/(mp4|quicktime|webm)/.test(f.type)) { var v = h('video'); v.src = url; v.controls = true; v.preload = 'metadata'; fs.appendChild(v); }
          var a = h('a', 'fileln', '↓ ' + f.name + ' · ' + size(f.size)); a.href = url + '?dl'; fs.appendChild(a); fs = fsOuter;
        });
        card.appendChild(fs);
      }
      var who = h('div', 'who');
      if (it.email) { var m = h('a', null, it.email); m.href = 'mailto:' + encodeURIComponent(it.email) + '?subject=' + encodeURIComponent('Re: your ' + it.app + ' feedback'); who.appendChild(m); }
      who.appendChild(h('span', null, it.ua ? short(it.ua) : ''));
      if (it.origin) who.appendChild(h('span', null, it.origin.replace(/^https?:\/\//, '')));
      if (it.mailError) who.appendChild(h('span', null, 'email failed: ' + it.mailError));
      card.appendChild(who);
      var acts = h('div', 'acts');
      var rd = h('button', 'act', it.status === 'new' ? 'Mark read' : 'Mark new'); rd.onclick = function () { setStatus(it, it.status === 'new' ? 'read' : 'new'); };
      var dn = h('button', 'act', it.status === 'done' ? 'Not done' : 'Done'); dn.onclick = function () { setStatus(it, it.status === 'done' ? 'read' : 'done'); };
      var del = h('button', 'act del', 'Delete'); del.onclick = function () {
        if (!confirm('Delete this feedback and its files for good? This can’t be undone.')) return;
        api('DELETE', 'api/item/' + it.id).then(function () { items = items.filter(function (x) { return x !== it; }); render(); });
      };
      acts.appendChild(rd); acts.appendChild(dn); acts.appendChild(del); card.appendChild(acts);
      list.appendChild(card);
    });
  }
  function size(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function short(ua) {
    var b = /Edg\/(\d+)/.exec(ua) ? 'Edge ' + /Edg\/(\d+)/.exec(ua)[1] : /Chrome\/(\d+)/.exec(ua) ? 'Chrome ' + /Chrome\/(\d+)/.exec(ua)[1] : /Version\/(\d+).*Safari/.exec(ua) ? 'Safari ' + /Version\/(\d+)/.exec(ua)[1] : /Firefox\/(\d+)/.exec(ua) ? 'Firefox ' + /Firefox\/(\d+)/.exec(ua)[1] : 'Browser';
    var os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Mac OS X/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : 'Linux';
    return b + ' · ' + os;
  }
  function load() {
    api('GET', 'api/list').then(function (r) {
      items = r.items || []; render();
      var id = location.hash.slice(1), el = id && document.getElementById(id);
      if (el) { el.classList.add('hl'); el.scrollIntoView({ block: 'start' }); var it = items.find(function (x) { return x.id === id; }); if (it && it.status === 'new') setStatus(it, 'read'); history.replaceState(null, '', location.pathname); }
    });
  }
  load();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
})();
