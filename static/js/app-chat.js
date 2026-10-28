/* Lemura chat: streaming replies, model picker, in-chat image generation, history. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = { models: {}, groups: [], model: '', state: {}, imageModels: [], imageModel: '', web: false, webOn: false,
    imgMode: false, history: [], conv: '', busy: false, ctrl: null, att: [], voiceTurn: false };
  var inp = $('inp'), sendBtn = $('send'), msgs = $('msgs'), thread = $('thread');
  var ICON = {
    send: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    stop: '<svg class="ic" viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor"/></svg>',
    copy: '<svg class="ic" viewBox="0 0 24 24"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
    redo: '<svg class="ic" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>'
  };
  var esc = MD.esc;
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };

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
      S.persona = d.image_persona || {};
      var saved = ''; try { saved = localStorage.getItem('lm_model') || ''; } catch (e) {}
      selectModel(S.models[saved] && !isLocked(saved) ? saved : (d.default_model && S.models[d.default_model] ? d.default_model : Object.keys(S.models)[0]), true);
      quota();
    });
  }
  function isLocked(id) { return (S.state.locked || []).indexOf(id) >= 0; }
  function selectModel(id, silent) {
    if (!id || !S.models[id]) return;
    if (isLocked(id) && !silent) {
      if (!LEMURA.user) { Auth.open(T('برای استفاده از این مدل وارد شوید')); return; }
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
          (isLocked(m.id) ? '<span class="lock">🔒</span>' : '<span class="pr">' + App.faNum(m.price) + T(' ت/۱K</span>')) + '</div>';
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
    if (st.tier === 'guest') q.textContent = App.faNum(st.remaining) + T(' پیام رایگان باقی‌مانده');
    else if (st.tier === 'free') q.textContent = App.faNum(st.remaining) + T(' پیام رایگان امروز');
    else q.textContent = '';
    if (st.balance != null && LEMURA.user) App.setBalance(st.balance);
  }

  // ---------- rendering ----------
  var ATT_RE = /<!--att:([\s\S]*?)-->/;
  function attList(text) { var m = ATT_RE.exec(String(text || '')); if (!m) return []; try { return JSON.parse(m[1]) || []; } catch (e) { return []; } }
  function stripTags(text) { return String(text || '').replace(/<!--(att|sources):[\s\S]*?-->/g, '').trim(); }
  function attHtml(list) {
    return list.map(function (a) {
      var u = MD.safeUrl(a.url);
      if (a.kind === 'image' && u) return '<a class="attimg" href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="' + esc(a.name) + '"></a>';
      return '<a class="attchip" href="' + esc(u) + '" target="_blank" rel="noopener">📎 ' + esc(a.name) + '</a>';
    }).join('');
  }
  function addUser(text, atts) {
    atts = atts || attList(text);
    var d = document.createElement('div'); d.className = 'msg user';
    d.innerHTML = '<div class="bubble">' + (atts.length ? '<div class="uatts">' + attHtml(atts) + '</div>' : '') + '<div class="utext"></div></div>';
    d.querySelector('.utext').textContent = stripTags(text); msgs.appendChild(d); scroll(true); return d;
  }
  function avatarFor(modelId) {
    if (modelId === '__image__') return (S.persona && S.persona.icon) || '';
    return (S.models[modelId] || {}).icon || '';
  }
  function setAvatar(el, icon) {
    var a = el.querySelector('.aiav'); if (!a) return;
    a.innerHTML = icon ? '<img src="' + esc(icon) + '" alt="">' : '⚡';
  }
  function addAI(modelId) {
    var m = { icon: avatarFor(modelId) };
    var d = document.createElement('div'); d.className = 'msg ai';
    d.innerHTML = '<div class="aiav">' + (m.icon ? '<img src="' + esc(m.icon) + '" alt="">' : '⚡') + '</div>' +
      '<div class="bubble"><div class="srcs" style="display:none"></div><div class="md"><span class="dots"><span></span><span></span><span></span></span></div><div class="macts" style="display:none"></div></div>';
    msgs.appendChild(d); scroll(true); spin(d, true); return d;
  }
  function spin(el, on) { var a = el && el.querySelector('.aiav'); if (a) a.classList.toggle('spin', !!on); }
  function setSources(el, src) {
    var box = el.querySelector('.srcs'); if (!src || !src.length) return;
    box.innerHTML = src.map(function (s) { var u = MD.safeUrl(s.url); return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">🔗 ' + esc(s.title || u) + '</a>' : ''; }).join('');
    box.style.display = 'flex';
  }
  function actions(el, text, meta, canRedo) {
    spin(el, false);
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
    spin(el, false);
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
        S.history.push({ role: m.role, content: stripTags(m.content) });
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
    text = (text != null ? text : inp.value).trim();
    var atts = opts.regen ? [] : S.att.filter(function (a) { return a.id; });
    if (S.att.some(function (a) { return !a.id; })) { App.toast(T('صبر کنید تا آپلود فایل تمام شود'), true); return; }
    if (!text && !atts.length) return;
    if (!opts.regen) { inp.value = ''; grow(); S.att = []; renderAtt(); }
    hero(false); ensureConv(text || atts[0].name);
    if (!opts.regen) addUser(text, atts);
    S.voiceTurn = !!opts.voice;
    var el = addAI(S.model), md = el.querySelector('.md');
    var hist = S.history.slice(-20); var first = !S.history.length;
    S.history.push({ role: 'user', content: text });
    setBusy(true); S.ctrl = new AbortController();
    var full = '', meta = '';
    fetch('/chat/stream', {
      method: 'POST', credentials: 'same-origin', signal: S.ctrl.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: S.model, history: hist, conversation_id: LEMURA.user ? S.conv : '', web_search: S.webOn,
        force_text: !!opts.forceText || !!opts.voice, attachments: atts.map(function (a) { return a.id; }) })
    }).then(function (res) {
      var ct = res.headers.get('Content-Type') || '';
      if (ct.indexOf('application/json') >= 0) return res.json().then(function (j) {
        S.history.pop(); errBox(el, j.error || T('خطا'), j.code); setBusy(false);
        if (window.Chat && Chat.onReply) Chat.onReply('', j.error || 'error');
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
              else if (L.type === 'image_start') {
                var pn = L.persona || {}; setAvatar(el, pn.icon); spin(el, true);
                var ph = document.createElement('div'); ph.className = 'imgph'; ph.style.marginTop = full ? '10px' : '0';
                ph.textContent = '🎨 ' + T('در حال ساخت تصویر...');
                if (!full) md.innerHTML = '';
                el.querySelector('.bubble').insertBefore(ph, el.querySelector('.macts')); scroll(true);
              }
              else if (L.type === 'image') {
                var p1 = el.querySelector('.imgph'); if (p1) p1.remove();
                full = (full ? full + '\n\n' : '') + L.markdown; md.innerHTML = MD.render(full);
                if (L.balance != null) App.setBalance(L.balance); scroll(true);
              }
              else if (L.type === 'image_error') {
                var p2 = el.querySelector('.imgph'); if (p2) p2.remove();
                var box = document.createElement('div'); box.className = 'errbox'; box.style.marginTop = '8px';
                box.textContent = L.message || T('ساخت تصویر ناموفق بود');
                if (L.code === 'login_required') { box.insertAdjacentHTML('beforeend', '<br><button class="btn btn-sm" onclick="Auth.open()">' + T('ورود / ثبت‌نام') + '</button>'); }
                if (L.code === 'need_charge') { box.insertAdjacentHTML('beforeend', '<br><a class="btn btn-sm" href="/wallet">' + T('شارژ کیف پول') + '</a>'); }
                if (!full) md.innerHTML = '';
                el.querySelector('.bubble').insertBefore(box, el.querySelector('.macts'));
              }
              else if (L.type === 'error') { full = full || ''; errBox(el, L.message || T('خطا در دریافت پاسخ')); }
              else if (L.type === 'done') {
                if (L.state) { S.state = L.state; quota(); }
                if (L.balance != null) App.setBalance(L.balance);
              }
            }
          });
          return pump();
        });
      }
      return pump().then(function () { finish(); });
    }).catch(function (e) {
      if (e && e.name === 'AbortError') { finish(true); return; }
      errBox(el, T('ارتباط با سرور برقرار نشد')); setBusy(false);
    });
    function finish(aborted) {
      md.classList.remove('cursor'); spin(el, false);
      if (full) { md.innerHTML = MD.render(full); S.history.push({ role: 'assistant', content: full }); actions(el, full, aborted ? T('متوقف شد') : '', true); }
      else if (!el.querySelector('.errbox')) { md.innerHTML = aborted ? '<span style="color:var(--t3)">متوقف شد.</span>' : ''; S.history.pop(); }
      setBusy(false); S.ctrl = null;
      if (first && LEMURA.user) App.loadConvs();
      if (window.Chat && Chat.onReply) Chat.onReply(full, aborted ? 'aborted' : '');
    }
  }

  function image(prompt, opts) {
    opts = opts || {};
    if (!LEMURA.user) { Auth.open(T('برای ساخت تصویر وارد شوید')); return; }
    if (!opts.regen) addUser(prompt);
    var el = addAI(''), md = el.querySelector('.md');
    var im = S.imageModels.filter(function (m) { return m.id === S.imageModel; })[0] || S.imageModels[0] || {};
    md.innerHTML = '<div class="imgph">🎨 در حال ساخت تصویر با ' + esc(im.name || '') + '...</div>';
    setBusy(true); scroll(true);
    var hadHistory = S.history.length > 0;
    S.history.push({ role: 'user', content: prompt });
    App.post('/chat/image', { prompt: prompt, model: S.imageModel, conversation_id: S.conv, has_history: hadHistory }, true).then(function (r) {
      setBusy(false);
      if (!r.ok) { S.history.pop(); errBox(el, r.error || T('ساخت تصویر ناموفق بود'), r.need_charge ? 'need_charge' : r.code); return; }
      var mdText = '![' + prompt.slice(0, 80).replace(/]/g, '') + '](' + r.url + ')';
      md.innerHTML = MD.render(mdText);
      S.history.push({ role: 'assistant', content: T('[تصویر ساخته شد: ') + prompt.slice(0, 120) + ']' });
      actions(el, r.url, '', false);
      if (r.balance != null) App.setBalance(r.balance);
      if (opts.fromChat) {
        var a = el.querySelector('.macts'), b = document.createElement('button');
        b.className = 'chip'; b.style.marginRight = '6px'; b.textContent = T('منظورم تصویر نبود، پاسخ متنی بده');
        b.onclick = function () { send(prompt, { regen: true, forceText: true }); }; a.appendChild(b);
      }
      scroll(true); if (!hadHistory) App.loadConvs();
    }).catch(function () { setBusy(false); S.history.pop(); errBox(el, T('ارتباط با سرور برقرار نشد')); });
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


  // ---------- attachments ----------
  function renderAtt() {
    var box = $('atts'); if (!box) return;
    box.innerHTML = S.att.map(function (a, i) {
      var thumb = a.kind === 'image' && a.preview ? '<img src="' + a.preview + '" alt="">' : '<span class="fi">📄</span>';
      return '<div class="att' + (a.id ? '' : ' up') + '">' + thumb + '<span class="an">' + esc(a.name) + '</span>' +
        '<button type="button" class="ax" data-rm="' + i + '" aria-label="remove">×</button></div>';
    }).join('');
    box.style.display = S.att.length ? 'flex' : 'none';
    sendBtn.disabled = !S.busy && !inp.value.trim() && !S.att.length;
  }
  function addFiles(files) {
    if (!LEMURA.user) { Auth.open(T('برای ارسال فایل وارد شوید')); return; }
    Array.prototype.slice.call(files || [], 0, 6 - S.att.length).forEach(function (f) {
      var a = { name: f.name, kind: /^image\//.test(f.type) ? 'image' : 'file', id: 0 };
      if (a.kind === 'image') a.preview = URL.createObjectURL(f);
      S.att.push(a); renderAtt();
      var fd = new FormData(); fd.append('file', f);
      fetch('/chat/upload', { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) {
        if (!r.ok) { S.att.splice(S.att.indexOf(a), 1); renderAtt(); App.toast(r.error || T('آپلود ناموفق بود'), true); return; }
        a.id = r.file.id; a.url = r.file.url; a.kind = r.file.kind; renderAtt();
      }).catch(function () { S.att.splice(S.att.indexOf(a), 1); renderAtt(); App.toast(T('آپلود ناموفق بود'), true); });
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-rm]'); if (!b) return;
    S.att.splice(+b.getAttribute('data-rm'), 1); renderAtt();
  });

  // ---------- composer ----------
  function grow() { inp.style.height = 'auto'; inp.style.height = Math.min(inp.scrollHeight, 220) + 'px'; sendBtn.disabled = !S.busy && !inp.value.trim() && !S.att.length; }
  inp.addEventListener('input', grow);
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !window.matchMedia('(max-width:860px)').matches) { e.preventDefault(); send(); }
  });
  document.querySelectorAll('.sug').forEach(function (b) { b.onclick = function () { send(b.getAttribute('data-q')); }; });
  $('newChatBtn').addEventListener('click', function (e) { e.preventDefault(); reset(); });

  inp.addEventListener('paste', function (e) {
    var fs = e.clipboardData && e.clipboardData.files; if (fs && fs.length) { e.preventDefault(); addFiles(fs); }
  });
  window.Chat = {
    send: function () { send(); }, open: open, reset: reset, addFiles: addFiles,
    sendText: function (t, opts) { send(t, opts || {}); }, isBusy: function () { return S.busy; },
    model: function () { return S.models[S.model] || {}; },
    pickModel: function (e) { renderModelList(''); $('mq').value = ''; App.menu(e, 'mlist'); setTimeout(function () { $('mq').focus(); }, 30); },
    toggleWeb: function () { S.webOn = !S.webOn; $('webChip').classList.toggle('on', S.webOn); },

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
