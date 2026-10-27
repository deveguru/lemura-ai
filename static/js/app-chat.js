/* Lemura chat: streaming replies, model picker, in-chat image generation, history. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = { models: {}, groups: [], model: '', state: {}, imageModels: [], imageModel: '', web: false, webOn: false,
    imgMode: false, history: [], conv: '', busy: false, ctrl: null };
  var inp = $('inp'), sendBtn = $('send'), msgs = $('msgs'), thread = $('thread');
  var ICON = {
    send: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    stop: '<svg class="ic" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>',
    copy: '<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    redo: '<svg class="ic" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>'
  };
  var esc = MD.esc;

  function newId() { var a = new Uint8Array(10); crypto.getRandomValues(a); return 'c' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function atBottom() { return thread.scrollHeight - thread.scrollTop - thread.clientHeight < 120; }
  function scroll(force) { if (force || atBottom()) thread.scrollTop = thread.scrollHeight; }
  function hero(show) { $('hero').style.display = show ? '' : 'none'; $('thread').parentNode.querySelector('.top').classList.toggle('bordered', !show); }
  function setBusy(b) {
    S.busy = b; sendBtn.classList.toggle('stop', b); sendBtn.innerHTML = b ? ICON.stop : ICON.send;
    sendBtn.disabled = !b && !inp.value.trim();
  }

  // ---------- state & models ----------
  function loadState() {
    return fetch('/chat/state', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      S.groups = d.models || []; S.models = {};
      S.groups.forEach(function (g) { g.models.forEach(function (m) { S.models[m.id] = m; }); });
      S.state = d.state || {}; S.imageModels = d.image_models || []; S.imageModel = d.image_default || '';
      S.web = !!d.web_search; $('webChip').style.display = S.web ? '' : 'none';
      $('imgChip').style.display = S.imageModels.length ? '' : 'none';
      var saved = ''; try { saved = localStorage.getItem('lm_model') || ''; } catch (e) {}
      selectModel(S.models[saved] && !isLocked(saved) ? saved : (d.default_model && S.models[d.default_model] ? d.default_model : Object.keys(S.models)[0]), true);
      quota();
    });
  }
  function isLocked(id) { return (S.state.locked || []).indexOf(id) >= 0; }
  function selectModel(id, silent) {
    if (!id || !S.models[id]) return;
    if (isLocked(id) && !silent) {
      if (!LEMURA.user) { Auth.open('برای استفاده از این مدل وارد شوید'); return; }
      App.toast('این مدل برای کاربرانی است که کیف پول خود را شارژ کرده‌اند', true); return;
    }
    S.model = id; var m = S.models[id];
    $('mpName').textContent = m.name; $('mpIcon').src = m.icon || ''; $('mpIcon').style.visibility = m.icon ? '' : 'hidden';
    try { if (!silent) localStorage.setItem('lm_model', id); } catch (e) {}
  }
  function renderModelList(q) {
    q = (q || '').toLowerCase(); var h = '';
    S.groups.forEach(function (g) {
      var ms = g.models.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) >= 0 || m.id.toLowerCase().indexOf(q) >= 0; });
      if (!ms.length) return;
      h += '<div class="mgroup">' + esc(g.provider) + '</div>';
      ms.forEach(function (m) {
        h += '<div class="mitem' + (m.id === S.model ? ' sel' : '') + '" data-mid="' + esc(m.id) + '"><img src="' + esc(m.icon || '') + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
          '<span class="nm">' + esc(m.name) + (m.vision ? ' <span title="پشتیبانی از تصویر">👁</span>' : '') + '</span>' +
          (isLocked(m.id) ? '<span class="lock">🔒</span>' : '<span class="pr">' + App.faNum(m.price) + ' ت/۱K</span>') + '</div>';
      });
    });
    $('mitems').innerHTML = h || '<div style="padding:10px;color:var(--t3)">مدلی یافت نشد</div>';
  }
  $('mitems').addEventListener('click', function (e) {
    var it = e.target.closest('[data-mid]'); if (!it) return; selectModel(it.getAttribute('data-mid')); App.closeMenus();
  });
  $('mq').addEventListener('input', function () { renderModelList(this.value); });
  function quota() {
    var st = S.state, q = $('quota');
    if (st.tier === 'guest') q.textContent = App.faNum(st.remaining) + ' پیام رایگان باقی‌مانده';
    else if (st.tier === 'free') q.textContent = App.faNum(st.remaining) + ' پیام رایگان امروز';
    else q.textContent = '';
    if (st.balance != null && LEMURA.user) App.setBalance(st.balance);
  }

  // ---------- rendering ----------
  function addUser(text) {
    var d = document.createElement('div'); d.className = 'msg user';
    d.innerHTML = '<div class="bubble"></div>'; d.firstChild.textContent = text; msgs.appendChild(d); scroll(true); return d;
  }
  function addAI(modelId) {
    var m = S.models[modelId] || {};
    var d = document.createElement('div'); d.className = 'msg ai';
    d.innerHTML = '<div class="aiav">' + (m.icon ? '<img src="' + esc(m.icon) + '" alt="">' : '⚡') + '</div>' +
      '<div class="bubble"><div class="srcs" style="display:none"></div><div class="md"><span class="dots"><span></span><span></span><span></span></span></div><div class="macts" style="display:none"></div></div>';
    msgs.appendChild(d); scroll(true); return d;
  }
  function setSources(el, src) {
    var box = el.querySelector('.srcs'); if (!src || !src.length) return;
    box.innerHTML = src.map(function (s) { var u = MD.safeUrl(s.url); return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">🔗 ' + esc(s.title || u) + '</a>' : ''; }).join('');
    box.style.display = 'flex';
  }
  function actions(el, text, meta, canRedo) {
    var a = el.querySelector('.macts'); a.style.display = 'flex';
    a.innerHTML = '<button class="ibtn" data-act="copy" title="کپی">' + ICON.copy + '</button>' +
      (canRedo ? '<button class="ibtn" data-act="redo" title="تولید مجدد">' + ICON.redo + '</button>' : '') +
      (meta ? '<span class="meta">' + esc(meta) + '</span>' : '');
    a.querySelector('[data-act=copy]').onclick = function () { navigator.clipboard.writeText(text.replace(/<!--sources:[\s\S]*?-->/g, '')).then(function () { App.toast('کپی شد'); }); };
    var r = a.querySelector('[data-act=redo]'); if (r) r.onclick = regenerate;
  }
  function errBox(el, text, code) {
    var btn = '';
    if (code === 'login_required' || code === 'guest_limit' || code === 'guest_model_locked') btn = '<button class="btn btn-sm" onclick="Auth.open()">ورود / ثبت‌نام</button>';
    else if (code === 'need_charge' || code === 'insufficient_balance' || code === 'free_limit') btn = '<a class="btn btn-sm" href="/wallet">شارژ کیف پول</a>';
    el.querySelector('.md').innerHTML = '<div class="errbox">' + esc(text) + (btn ? '<br>' + btn : '') + '</div>';
  }

  // ---------- conversations ----------
  function reset() {
    if (S.ctrl) S.ctrl.abort();
    S.history = []; S.conv = ''; App.currentConv = ''; msgs.innerHTML = ''; hero(true); $('shareBtn').style.display = 'none';
    history.replaceState(null, '', '/'); App.renderConvs(); inp.focus();
  }
  function open(id) {
    if (S.busy && S.ctrl) S.ctrl.abort();
    App.post('/chat/conversation', { conversation_id: id }, true).then(function (r) {
      if (!r.success || !r.data.length) { reset(); return; }
      S.conv = id; App.currentConv = id; S.history = []; msgs.innerHTML = ''; hero(false);
      $('shareBtn').style.display = '';
      history.replaceState(null, '', '/c/' + encodeURIComponent(id));
      r.data.forEach(function (m, i) {
        if (m.role === 'user') addUser(m.content);
        else {
          var el = addAI(m.model); el.querySelector('.md').innerHTML = MD.render(m.content);
          setSources(el, MD.sources(m.content)); actions(el, m.content, '', i === r.data.length - 1);
        }
        S.history.push({ role: m.role, content: String(m.content).replace(/<!--sources:[\s\S]*?-->/g, '') });
      });
      App.renderConvs(); scroll(true);
    });
  }
  function ensureConv(title) {
    if (!S.conv) {
      S.conv = newId(); App.currentConv = S.conv;
      if (LEMURA.user) { history.replaceState(null, '', '/c/' + S.conv); App.upsertConv(S.conv, title.slice(0, 60)); $('shareBtn').style.display = ''; }
    } else if (LEMURA.user) App.upsertConv(S.conv, title.slice(0, 60));
  }

  // ---------- sending ----------
  function send(text, opts) {
    opts = opts || {};
    if (S.busy) { if (S.ctrl) S.ctrl.abort(); return; }
    text = (text != null ? text : inp.value).trim(); if (!text) return;
    if (!opts.regen) { inp.value = ''; grow(); }
    hero(false); ensureConv(text);
    if (S.imgMode || opts.image) return image(text, opts);
    if (!opts.regen) addUser(text);
    var el = addAI(S.model), md = el.querySelector('.md');
    var hist = S.history.slice(-20); var first = !S.history.length;
    S.history.push({ role: 'user', content: text });
    setBusy(true); S.ctrl = new AbortController();
    var full = '', meta = '';
    fetch('/chat/stream', {
      method: 'POST', credentials: 'same-origin', signal: S.ctrl.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: S.model, history: hist, conversation_id: LEMURA.user ? S.conv : '', web_search: S.webOn, force_text: !!opts.forceText })
    }).then(function (res) {
      var ct = res.headers.get('Content-Type') || '';
      if (ct.indexOf('application/json') >= 0) return res.json().then(function (j) {
        if (j.intent === 'image') { el.remove(); S.history.pop(); setBusy(false); return image(text, { fromChat: true }); }
        S.history.pop(); errBox(el, j.error || 'خطا', j.code); setBusy(false);
      });
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
      md.innerHTML = ''; md.classList.add('cursor');
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += dec.decode(r.value, { stream: true });
          var parts = buf.split('\n\n'); buf = parts.pop();
          parts.forEach(function (p) {
            p = p.trim(); if (p.indexOf('data:') !== 0) return;
            var j; try { j = JSON.parse(p.slice(5)); } catch (e) { return; }
            if (j.d) { full += j.d; md.innerHTML = MD.render(full); scroll(); }
            else if (j.lemura) {
              var L = j.lemura;
              if (L.type === 'sources') setSources(el, L.sources);
              else if (L.type === 'error') { full = full || ''; errBox(el, L.message || 'خطا در دریافت پاسخ'); }
              else if (L.type === 'done') {
                if (L.state) { S.state = L.state; quota(); }
                meta = L.cost ? App.faNum(L.cost) + ' تومان · ' + App.faNum(L.tokens) + ' توکن' : '';
              }
            }
          });
          return pump();
        });
      }
      return pump().then(function () { finish(); });
    }).catch(function (e) {
      if (e && e.name === 'AbortError') { finish(true); return; }
      errBox(el, 'ارتباط با سرور برقرار نشد'); setBusy(false);
    });
    function finish(aborted) {
      md.classList.remove('cursor');
      if (full) { md.innerHTML = MD.render(full); S.history.push({ role: 'assistant', content: full }); actions(el, full, meta + (aborted ? ' (متوقف شد)' : ''), true); }
      else if (!el.querySelector('.errbox')) { md.innerHTML = aborted ? '<span style="color:var(--t3)">متوقف شد.</span>' : ''; S.history.pop(); }
      setBusy(false); S.ctrl = null;
      if (first && LEMURA.user) App.loadConvs();
    }
  }

  function image(prompt, opts) {
    opts = opts || {};
    if (!LEMURA.user) { Auth.open('برای ساخت تصویر وارد شوید'); return; }
    if (!opts.regen) addUser(prompt);
    var el = addAI(''), md = el.querySelector('.md');
    var im = S.imageModels.filter(function (m) { return m.id === S.imageModel; })[0] || S.imageModels[0] || {};
    md.innerHTML = '<div class="imgph">🎨 در حال ساخت تصویر با ' + esc(im.name || '') + '...</div>';
    setBusy(true); scroll(true);
    var hadHistory = S.history.length > 0;
    S.history.push({ role: 'user', content: prompt });
    App.post('/chat/image', { prompt: prompt, model: S.imageModel, conversation_id: S.conv, has_history: hadHistory }, true).then(function (r) {
      setBusy(false);
      if (!r.ok) { S.history.pop(); errBox(el, r.error || 'ساخت تصویر ناموفق بود', r.need_charge ? 'need_charge' : r.code); return; }
      var mdText = '![' + prompt.slice(0, 80).replace(/]/g, '') + '](' + r.url + ')';
      md.innerHTML = MD.render(mdText);
      S.history.push({ role: 'assistant', content: '[تصویر ساخته شد: ' + prompt.slice(0, 120) + ']' });
      actions(el, r.url, (r.cost ? App.faNum(r.cost) + ' تومان · ' : '') + (r.model || ''), false);
      if (r.balance != null) App.setBalance(r.balance);
      if (opts.fromChat) {
        var a = el.querySelector('.macts'), b = document.createElement('button');
        b.className = 'chip'; b.style.marginRight = '6px'; b.textContent = 'منظورم تصویر نبود، پاسخ متنی بده';
        b.onclick = function () { send(prompt, { regen: true, forceText: true }); }; a.appendChild(b);
      }
      scroll(true); if (!hadHistory) App.loadConvs();
    }).catch(function () { setBusy(false); S.history.pop(); errBox(el, 'ارتباط با سرور برقرار نشد'); });
  }

  function regenerate() {
    if (S.busy) return;
    var lastUser = null;
    for (var i = S.history.length - 1; i >= 0; i--) if (S.history[i].role === 'user') { lastUser = S.history[i].content; break; }
    if (lastUser == null) return;
    S.history = S.history.slice(0, i);
    var last = msgs.lastElementChild; if (last && last.classList.contains('ai')) last.remove();
    send(lastUser, { regen: true, forceText: true });
  }

  // ---------- composer ----------
  function grow() { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 220) + 'px'; sendBtn.disabled = !S.busy && !inp.value.trim(); }
  inp.addEventListener('input', grow);
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !window.matchMedia('(max-width:860px)').matches) { e.preventDefault(); send(); }
  });
  document.querySelectorAll('.sug').forEach(function (b) { b.onclick = function () { send(b.getAttribute('data-q')); }; });
  $('newChatBtn').addEventListener('click', function (e) { e.preventDefault(); reset(); });

  window.Chat = {
    send: function () { send(); }, open: open, reset: reset,
    pickModel: function (e) { renderModelList(''); $('mq').value = ''; App.menu(e, 'mlist'); setTimeout(function () { $('mq').focus(); }, 30); },
    toggleWeb: function () { S.webOn = !S.webOn; $('webChip').classList.toggle('on', S.webOn); },
    toggleImage: function () {
      S.imgMode = !S.imgMode; $('imgChip').classList.toggle('on', S.imgMode);
      inp.placeholder = S.imgMode ? 'تصویری که می‌خواهید را توصیف کنید...' : 'پیام خود را بنویسید...'; inp.focus();
    },
    share: function () {
      if (!S.conv || !LEMURA.user) return;
      App.post('/chat/share', { conversation_id: S.conv }, true).then(function (r) {
        if (r.success) navigator.clipboard.writeText(r.data.url).then(function () { App.toast('لینک اشتراک کپی شد'); }, function () { prompt('لینک:', r.data.url); });
      });
    }
  };
  loadState().then(function () {
    if (CHAT_INIT.conv && LEMURA.user) open(CHAT_INIT.conv);
    var q = new URLSearchParams(location.search).get('q'); if (q) send(q);
  });
  setBusy(false);
})();
