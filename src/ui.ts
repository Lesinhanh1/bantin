// Giao diện một trang, không framework. (JS bên trong không dùng backtick để tránh xung đột template string.)
export const UI_HTML = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bản tin</title>
<style>
:root{--bg:#f6f6f3;--card:#fff;--fg:#1c1c1a;--muted:#6d6d67;--line:#e3e3dd;--accent:#2563c9;--good:#1d8048;--mid:#a86b12}
@media (prefers-color-scheme:dark){:root{--bg:#131312;--card:#1d1d1b;--fg:#ecece7;--muted:#9b9b93;--line:#2e2e2a;--accent:#79a6ff;--good:#52c487;--mid:#e2a94d}}
*{box-sizing:border-box}
body{margin:0;font:15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--fg)}
header{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 16px}
.wrap{max-width:820px;margin:0 auto}
.row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.row+.row{margin-top:8px}
h1{font-size:17px;margin:0 10px 0 0}
button,.chip{font:inherit;font-size:14px;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:999px;padding:3px 12px;cursor:pointer}
.chip.on{background:var(--fg);color:var(--bg);border-color:var(--fg)}
.sp{flex:1}
#status{color:var(--muted);font-size:13px}
main{padding:6px 16px 60px}
.item{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:10px 0}
.item.done{opacity:.45}
a.t{color:var(--fg);font-weight:600;text-decoration:none;font-size:15.5px}
a.t:hover{color:var(--accent)}
.meta{color:var(--muted);font-size:12.5px;margin:3px 0 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.meta a{color:var(--muted)}
.sc{font-weight:700;font-size:12px;border:1px solid currentColor;border-radius:6px;padding:0 6px}
.hi{color:var(--good)}.md{color:var(--mid)}.lo{color:var(--muted)}
.sum{margin:7px 0 0}
.snip{margin:7px 0 0;color:var(--muted);font-size:14px}
.acts{display:flex;gap:6px;margin-top:9px}
.acts button{font-size:12.5px;padding:2px 10px}
.acts button.on{border-color:var(--accent);color:var(--accent)}
.empty{color:var(--muted);text-align:center;padding:48px 0}
form.login{max-width:360px;margin:60px auto;display:flex;gap:8px}
form.login input{flex:1;font:inherit;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg)}
</style>
</head>
<body>
<header><div class="wrap">
  <div class="row">
    <h1>📰 Bản tin</h1>
    <span class="chip on" data-view="top">Nổi bật</span>
    <span class="chip" data-view="new">Mới nhất</span>
    <span class="chip" data-view="saved">Đã lưu</span>
    <span class="sp"></span>
    <span id="status"></span>
    <button id="run" title="Kéo nguồn + chấm điểm ngay">⟳ Chạy</button>
    <button id="key" title="Đổi token">🔑</button>
  </div>
  <div class="row">
    <span class="chip on" data-cat="">Tất cả</span>
    <span class="chip" data-cat="dev-ai">Dev/AI</span>
    <span class="chip" data-cat="trading">Trading</span>
    <span class="chip" data-cat="pkm">PKM</span>
  </div>
</div></header>
<main><div class="wrap" id="list"></div></main>

<script>
(function(){
  var S = { view: 'top', cat: '', token: get('bantin_token') };
  var list = document.getElementById('list');
  var statusEl = document.getElementById('status');

  function get(k){ try { return localStorage.getItem(k) || ''; } catch(e){ return ''; } }
  function put(k,v){ try { if (v) localStorage.setItem(k,v); else localStorage.removeItem(k); } catch(e){} }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function api(path, opts){
    opts = opts || {};
    opts.headers = Object.assign({ 'Authorization': 'Bearer ' + S.token }, opts.headers || {});
    return fetch(path, opts).then(function(r){
      if (r.status === 401) { S.token = ''; put('bantin_token',''); showLogin(); throw new Error('Sai token'); }
      if (!r.ok) return r.text().then(function(t){ throw new Error(t || ('HTTP ' + r.status)); });
      return r;
    });
  }

  function showLogin(){
    list.innerHTML = '';
    var f = el('form','login'); var i = el('input'); i.type = 'password'; i.placeholder = 'ACCESS_TOKEN';
    var b = el('button', null, 'Vào'); b.type = 'submit';
    f.appendChild(i); f.appendChild(b); list.appendChild(f); i.focus();
    f.onsubmit = function(ev){ ev.preventDefault(); S.token = i.value.trim(); put('bantin_token', S.token); load(); };
  }

  function ago(ts){
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 60) return m + ' phút';
    var h = Math.round(m / 60); if (h < 48) return h + ' giờ';
    return Math.round(h / 24) + ' ngày';
  }

  function load(){
    if (!S.token) return showLogin();
    statusEl.textContent = 'Đang tải…';
    var q = '/api/items?view=' + S.view + (S.cat ? '&cat=' + S.cat : '');
    api(q).then(function(r){ return r.json(); }).then(function(items){
      statusEl.textContent = items.length + ' tin';
      render(items);
    }).catch(function(e){ statusEl.textContent = e.message; });
  }

  function render(items){
    list.innerHTML = '';
    if (!items.length) { list.appendChild(el('div','empty', S.view === 'saved' ? 'Chưa lưu tin nào.' : 'Chưa có tin. Bấm ⟳ Chạy để kéo tin.')); return; }
    items.forEach(function(it){ list.appendChild(card(it)); });
  }

  function card(it){
    var c = el('div','item');
    var a = el('a','t', it.title); a.href = it.url; a.target = '_blank'; a.rel = 'noopener';
    c.appendChild(a);

    var meta = el('div','meta');
    if (it.score != null) { var s = el('span', 'sc ' + (it.score >= 8 ? 'hi' : it.score >= 5 ? 'md' : 'lo'), String(it.score)); meta.appendChild(s); }
    meta.appendChild(el('span', null, it.source_name));
    meta.appendChild(el('span', null, ago(it.published_at)));
    if (it.extra && it.extra.discussion) {
      var d = el('a', null, (it.extra.points || 0) + '▲ · ' + (it.extra.comments || 0) + ' bình luận');
      d.href = it.extra.discussion; d.target = '_blank'; d.rel = 'noopener'; meta.appendChild(d);
    }
    (it.tags || []).forEach(function(t){ meta.appendChild(el('span', null, '#' + t)); });
    c.appendChild(meta);

    if (it.summary) c.appendChild(el('div','sum', it.summary));
    else if (it.snippet) c.appendChild(el('div','snip', it.snippet.slice(0, 260)));

    var acts = el('div','acts');
    var save = el('button', it.user_action === 'saved' ? 'on' : '', it.user_action === 'saved' ? '★ Đã lưu' : '☆ Lưu');
    save.onclick = function(){
      var next = it.user_action === 'saved' ? null : 'saved';
      act(it.id, next).then(function(){ it.user_action = next; c.replaceWith(card(it)); });
    };
    var skip = el('button', null, '✕ Bỏ qua');
    skip.onclick = function(){ act(it.id, 'dismissed').then(function(){ c.classList.add('done'); setTimeout(function(){ c.remove(); }, 250); }); };
    var md = el('button', null, '⬇ .md');
    md.title = 'Tải file Markdown cho Obsidian';
    md.onclick = function(){ download(it.id); };
    acts.appendChild(save); if (S.view !== 'saved') acts.appendChild(skip); acts.appendChild(md);
    c.appendChild(acts);
    return c;
  }

  function act(id, action){
    return api('/api/items/' + id + '/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: action }) })
      .catch(function(e){ statusEl.textContent = e.message; throw e; });
  }

  function download(id){
    api('/api/items/' + id + '/md').then(function(r){
      var cd = r.headers.get('content-disposition') || '';
      var m = cd.match(/filename\\*=UTF-8''([^;]+)/);
      var name = m ? decodeURIComponent(m[1]) : 'bantin.md';
      return r.blob().then(function(b){
        var u = URL.createObjectURL(b); var a = document.createElement('a');
        a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function(){ URL.revokeObjectURL(u); }, 1000);
      });
    }).catch(function(e){ statusEl.textContent = e.message; });
  }

  document.querySelectorAll('[data-view]').forEach(function(ch){
    ch.onclick = function(){ document.querySelectorAll('[data-view]').forEach(function(x){ x.classList.remove('on'); }); ch.classList.add('on'); S.view = ch.dataset.view; load(); };
  });
  document.querySelectorAll('[data-cat]').forEach(function(ch){
    ch.onclick = function(){ document.querySelectorAll('[data-cat]').forEach(function(x){ x.classList.remove('on'); }); ch.classList.add('on'); S.cat = ch.dataset.cat; load(); };
  });
  document.getElementById('key').onclick = function(){ S.token = ''; put('bantin_token',''); showLogin(); };
  document.getElementById('run').onclick = function(){
    statusEl.textContent = 'Đang chạy…';
    api('/api/run?force=1', { method: 'POST' }).then(function(r){ return r.json(); }).then(function(r){
      var added = (r.fetched || []).reduce(function(s,x){ return s + (x.added || 0); }, 0);
      var errs = (r.fetched || []).filter(function(x){ return x.error; }).length;
      statusEl.textContent = '+' + added + ' tin, chấm ' + ((r.scored && r.scored.scored) || 0) + (errs ? ', ' + errs + ' nguồn lỗi' : '') + (r.scored && r.scored.error ? ' (LLM lỗi)' : '');
      setTimeout(load, 600);
    }).catch(function(e){ statusEl.textContent = e.message; });
  };

  load();
})();
</script>
</body>
</html>`;
