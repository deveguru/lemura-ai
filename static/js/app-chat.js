/* Lemura chat: streaming replies (background turns that survive reloads), model picker, the + menu (files, web
   search, image & animation mode, individual tools), history. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = { models: {}, groups: [], model: '', state: {}, imageModels: [], imageModel: '', web: false, webOn: false,
    creative: false, pinned: {}, tools: null, history: [], conv: '', busy: false, ctrl: null, turn: '', att: [] };
  var inp = $('inp'), sendBtn = $('send'), msgs = $('msgs'), thread = $('thread');
  var ICON = {
    send: App.ic('arrow-up', 'ic'), stop: App.ic('square', 'ic fill'), copy: App.ic('copy', 'ic'), redo: App.ic('refresh-cw', 'ic')
  };
  var esc = MD.esc;
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };

  function newId() { var a = new Uint8Array(10); crypto.getRandomValues(a); return 'c' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function atBottom() { return thread.scrollHeight - thread.scrollTop - thread.clientHeight < 120; }
  function scroll(force) { if (force || atBottom()) thread.scrollTop = thread.scrollHeight; }
  function hero(show) { $('hero').style.display = show ? '' : 'none'; $('thread').parentNode.querySelector('.top').classList.toggle('bordered', !show); }
  function setBusy(b) {
    S.busy = b; sendBtn.classList.toggle('stop', b); sendBtn.innerHTML = b ? ICON.stop : ICON.send;
    sendBtn.disabled = !b && !inp.value.trim() && !S.att.length;
  }

  // ---------- state & models ----------
  function loadState() {
    return fetch('/chat/state', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      S.groups = d.models || []; S.models = {};
      S.groups.forEach(function (g) { g.models.forEach(function (m) { S.models[m.id] = m; }); });
      S.state = d.state || {}; S.imageModels = d.image_models || []; S.imageModel = d.image_default || '';
      S.web = !!d.web_search; $('pmWeb').hidden = !S.web;
      S.persona = d.image_persona || {};
      var saved = ''; try { saved = localStorage.getItem('lm_model') || ''; } catch (e) { /* private mode */ }
      selectModel(S.models[saved] && !isLocked(saved) ? saved : (d.default_model && S.models[d.default_model] ? d.default_model : Object.keys(S.models)[0]), true);
      quota();
    });
  }
  function isLocked(id) { return (S.state.locked || []).indexOf(id) >= 0; }
  function selectModel(id, silent) {
    if (!id || !S.models[id]) return;
    if (isLocked(id) && !silent) {
      if (!LEMURA.user) { Auth.open(T('برای استفاده از این مدل وارد شوید')); return; }
      App.toast(T('این مدل برای کاربرانی است که کیف پول خود را شارژ کرده‌اند'), true); return;
    }
    S.model = id; var m = S.models[id];
    $('mpName').textContent = m.name; $('mpIcon').src = m.icon || ''; $('mpIcon').style.visibility = m.icon ? '' : 'hidden';
    try { if (!silent) localStorage.setItem('lm_model', id); } catch (e) { /* private mode */ }
  }
  function renderModelList(q) {
    q = (q || '').toLowerCase(); var h = '';
    S.groups.forEach(function (g) {
      var ms = g.models.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) >= 0 || m.id.toLowerCase().indexOf(q) >= 0; });
      if (!ms.length) return;
      h += '<div class="mgroup">' + esc(g.provider) + '</div>';
      ms.forEach(function (m) {
        h += '<div class="mitem' + (m.id === S.model ? ' sel' : '') + '" data-mid="' + esc(m.id) + '"><img src="' + esc(m.icon || '') + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
          '<span class="nm">' + esc(m.name) + (m.vision ? ' <span title="' + T('پشتیبانی از تصویر') + '">' + App.ic('eye') + '</span>' : '') + '</span>' +
          (isLocked(m.id) ? '<span class="lock">' + App.ic('lock') + '</span>' : '<span class="pr">' + App.faNum(m.price) + T(' ت/۱K</span>')) + '</div>';
      });
    });
    $('mitems').innerHTML = h || '<div style="padding:10px;color:var(--t3)">' + T('مدلی یافت نشد') + '</div>';
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

  // ---------- + menu: files, web search, image & animation mode, individual tools ----------
  function chips() {
    var c = [];
    if (S.webOn) c.push('<span class="mchip" data-off="web">' + App.ic('globe') + ' ' + T('جستجوی وب') + '<b>×</b></span>');
    if (S.creative) c.push('<span class="mchip cr" data-off="creative">' + App.ic('palette') + ' ' + T('تصویر و انیمیشن') + '<b>×</b></span>');
    Object.keys(S.pinned).forEach(function (k) {
      c.push('<span class="mchip" data-off="tool:' + esc(k) + '">' + App.ic(S.pinned[k].icon || 'wrench') + ' ' + esc(S.pinned[k].name) + '<b>×</b></span>');
    });
    var box = $('modeChips'); box.innerHTML = c.join(''); box.hidden = !c.length;
    $('plusBtn').classList.toggle('on', c.length > 0);
    var pm = $('plusMenu');
    pm.querySelector('[data-act=web]').classList.toggle('on', S.webOn);
    pm.querySelector('[data-act=creative]').classList.toggle('on', S.creative);
    pm.querySelectorAll('[data-tool]').forEach(function (b) { b.classList.toggle('on', !!S.pinned[b.getAttribute('data-tool')]); });
  }
  $('modeChips').addEventListener('click', function (e) {
    var x = e.target.closest('[data-off]'); if (!x) return;
    var k = x.getAttribute('data-off');
    if (k === 'web') S.webOn = false; else if (k === 'creative') S.creative = false; else delete S.pinned[k.slice(5)];
    chips();
  });
  function loadTools() {
    if (S.tools || !LEMURA.user) {
      if (!LEMURA.user) $('pmTools').innerHTML = '<div class="muted" style="padding:8px">' + T('برای استفاده از ابزارها وارد شوید') + '</div>';
      return;
    }
    fetch('/pf/tools', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) {
      S.tools = (r.tools || []).filter(function (t) { return t.status === 'live' && ['job_status', 'schedule_task', 'execute_http_request'].indexOf(t.tool_id) < 0; });
      renderTools('');
    }).catch(function () { $('pmTools').innerHTML = '<div class="muted" style="padding:8px">' + T('خطا') + '</div>'; });
  }
  function renderTools(q) {
    if (!S.tools) return;
    q = (q || '').toLowerCase();
    var groups = {}, order = [];
    S.tools.forEach(function (t) {
      if (q && (t.name + ' ' + (t.summary || '') + ' ' + t.tool_id).toLowerCase().indexOf(q) < 0) return;
      var g = t.source === 'builtin' ? (t.category_label || '') : T('اتصال‌های API من');
      if (!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(t);
    });
    $('pmTools').innerHTML = order.map(function (g) {
      return '<div class="pmg">' + esc(T(g)) + '</div>' + groups[g].map(function (t) {
        return '<button type="button" data-tool="' + esc(t.tool_id) + '" class="' + (S.pinned[t.tool_id] ? 'on' : '') + '">' + App.ic(t.icon || 'wrench') +
          ' <span><b>' + esc(t.name) + '</b><small>' + esc(t.summary || '') + '</small></span><i class="pmck"></i></button>';
      }).join('');
    }).join('') || '<div class="muted" style="padding:8px">' + T('ابزاری پیدا نشد') + '</div>';
  }
  $('pmQ').addEventListener('input', function () { renderTools(this.value); });
  $('plusMenu').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var act = b.getAttribute('data-act'), tool = b.getAttribute('data-tool');
    if (act === 'file') { App.closeMenus(); $('fileIn').click(); return; }
    if (act === 'web') S.webOn = !S.webOn;
    else if (act === 'creative') {
      if (!LEMURA.user) { App.closeMenus(); Auth.open(T('برای ساخت تصویر و انیمیشن وارد شوید')); return; }
      S.creative = !S.creative;
    } else if (tool) {
      if (S.pinned[tool]) delete S.pinned[tool];
      else { var t = S.tools.filter(function (x) { return x.tool_id === tool; })[0]; if (t) S.pinned[tool] = { name: t.name, icon: t.icon }; }
    }
    chips();
  });

  // ---------- rendering ----------
  var ATT_RE = /<!--att:([\s\S]*?)-->/;
  function attList(text) { var m = ATT_RE.exec(String(text || '')); if (!m) return []; try { return JSON.parse(m[1]) || []; } catch (e) { return []; } }
  function stripTags(text) { return String(text || '').replace(/<!--(att|sources):[\s\S]*?-->/g, '').trim(); }
  function attHtml(list) {
    return list.map(function (a) {
      var u = MD.safeUrl(a.url);
      if (a.kind === 'image' && u) return '<a class="attimg" href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="' + esc(a.name) + '"></a>';
      return '<a class="attchip" href="' + esc(u) + '" target="_blank" rel="noopener">' + App.ic('paperclip') + ' ' + esc(a.name) + '</a>';
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
    a.innerHTML = icon ? '<img src="' + esc(icon) + '" alt="">' : App.ic('zap');
  }
  function addAI(modelId) {
    var icon = avatarFor(modelId);
    var d = document.createElement('div'); d.className = 'msg ai';
    d.innerHTML = '<div class="aiav">' + (icon ? '<img src="' + esc(icon) + '" alt="">' : App.ic(modelId === '__tool__' ? 'wrench' : 'zap')) + '</div>' +
      '<div class="bubble"><div class="srcs" style="display:none"></div><div class="md"><span class="dots"><span></span><span></span><span></span></span></div><div class="macts" style="display:none"></div></div>';
    msgs.appendChild(d); scroll(true); spin(d, true); return d;
  }
  function spin(el, on) { var a = el && el.querySelector('.aiav'); if (a) a.classList.toggle('spin', !!on); }
  function setSources(el, src) {
    var box = el.querySelector('.srcs'); if (!src || !src.length) return;
    box.innerHTML = src.map(function (s) { var u = MD.safeUrl(s.url); return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + App.ic('link') + ' ' + esc(s.title || u) + '</a>' : ''; }).join('');
    box.style.display = 'flex';
  }
  function actions(el, text, meta, canRedo) {
    spin(el, false);
    var a = el.querySelector('.macts'); a.style.display = 'flex';
    a.innerHTML = '<button class="ibtn" data-act="copy" title="' + T('کپی') + '">' + ICON.copy + '</button>' +
      (canRedo ? '<button class="ibtn" data-act="redo" title="' + T('تولید مجدد') + '">' + ICON.redo + '</button>' : '') +
      (meta ? '<span class="meta">' + esc(meta) + '</span>' : '');
    a.querySelector('[data-act=copy]').onclick = function () { navigator.clipboard.writeText(stripTags(text)).then(function () { App.toast(T('کپی شد')); }); };
    var r = a.querySelector('[data-act=redo]'); if (r) r.onclick = regenerate;
  }
  function errBox(el, text, code) {
    var btn = '';
    if (code === 'login_required' || code === 'guest_limit' || code === 'guest_model_locked') btn = '<button class="btn btn-sm" onclick="Auth.open()">' + T('ورود / ثبت‌نام') + '</button>';
    else if (code === 'need_charge' || code === 'insufficient_balance' || code === 'free_limit') btn = '<a class="btn btn-sm" href="/wallet">' + T('شارژ کیف پول') + '</a>';
    spin(el, false);
    el.querySelector('.md').innerHTML = '<div class="errbox">' + esc(text) + (btn ? '<br>' + btn : '') + '</div>';
  }

  // ---------- conversations ----------
  function reset() {
    stopStream();
    S.history = []; S.conv = ''; App.currentConv = ''; msgs.innerHTML = ''; hero(true); $('shareBtn').style.display = 'none';
    history.replaceState(null, '', '/'); App.renderConvs(); inp.focus();
  }
  function open(id) {
    stopStream();
    App.post('/chat/conversation', { conversation_id: id }, true).then(function (r) {
      if (!r.success || (!r.data.length && !r.active_turn)) { reset(); return; }
      S.conv = id; App.currentConv = id; S.history = []; msgs.innerHTML = ''; hero(false);
      $('shareBtn').style.display = '';
      history.replaceState(null, '', '/c/' + encodeURIComponent(id));
      r.data.forEach(function (m, i) {
        if (m.role === 'user') addUser(m.content);
        else {
          var el = addAI(m.model); el.querySelector('.md').innerHTML = MD.render(m.content);
          setSources(el, MD.sources(m.content)); actions(el, m.content, '', i === r.data.length - 1 && !r.active_turn);
        }
        S.history.push({ role: m.role, content: stripTags(m.content) });
      });
      App.renderConvs(); scroll(true);
      if (r.active_turn) attach(r.active_turn, r.active_model || S.model);    // a reply is still being produced on the server
    });
  }
  function ensureConv(title) {
    if (!S.conv) {
      S.conv = newId(); App.currentConv = S.conv;
      if (LEMURA.user) { history.replaceState(null, '', '/c/' + S.conv); App.upsertConv(S.conv, title.slice(0, 60)); $('shareBtn').style.display = ''; }
    } else if (LEMURA.user) App.upsertConv(S.conv, title.slice(0, 60));
  }

  // ---------- streaming (a turn runs on the server; this only displays it) ----------
  function stopStream() { if (S.ctrl) { try { S.ctrl.abort(); } catch (e) { /* noop */ } } S.ctrl = null; }

  // consume an SSE response into the AI bubble `el`; st = {full, idx, turn, done}
  function consume(res, el, st) {
    var md = el.querySelector('.md');
    var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
    function onEvent(j) {
      if (j.lemura && j.lemura.type === 'turn') { st.turn = S.turn = j.lemura.id; return; }
      st.idx++;
      if (j.d) { if (!st.text) { md.innerHTML = ''; md.classList.add('cursor'); st.text = true; } st.full += j.d; md.innerHTML = MD.render(st.full); scroll(); return; }
      if (!j.lemura) return;
      var L = j.lemura;
      if (L.type === 'sources') setSources(el, L.sources);
      else if (L.type === 'image_start') {
        var pn = L.persona || {}; setAvatar(el, pn.icon); spin(el, true);
        var ph = document.createElement('div'); ph.className = 'imgph'; ph.style.marginTop = st.full ? '10px' : '0';
        ph.innerHTML = App.ic('palette') + ' ' + T('در حال ساخت تصویر...');
        if (!st.full) md.innerHTML = '';
        el.querySelector('.bubble').insertBefore(ph, el.querySelector('.macts')); scroll(true);
      } else if (L.type === 'image') {
        var p1 = el.querySelector('.imgph'); if (p1) p1.remove();
        st.full = (st.full ? st.full + '\n\n' : '') + L.markdown; md.innerHTML = MD.render(st.full);
        if (L.balance != null) App.setBalance(L.balance); scroll(true);
      } else if (L.type === 'image_error') {
        var p2 = el.querySelector('.imgph'); if (p2) p2.remove();
        var box = document.createElement('div'); box.className = 'errbox'; box.style.marginTop = '8px';
        box.textContent = L.message || T('ساخت تصویر ناموفق بود');
        if (L.code === 'login_required') box.insertAdjacentHTML('beforeend', '<br><button class="btn btn-sm" onclick="Auth.open()">' + T('ورود / ثبت‌نام') + '</button>');
        if (L.code === 'need_charge') box.insertAdjacentHTML('beforeend', '<br><a class="btn btn-sm" href="/wallet">' + T('شارژ کیف پول') + '</a>');
        if (!st.full) md.innerHTML = '';
        el.querySelector('.bubble').insertBefore(box, el.querySelector('.macts'));
      } else if (L.type === 'error') { st.error = true; errBox(el, L.message || T('خطا در دریافت پاسخ')); }
      else if (L.type === 'done') {
        st.done = true; st.stopped = !!L.stopped;
        if (L.state) { S.state = L.state; quota(); }
        if (L.balance != null) App.setBalance(L.balance);
      } else if (window.ChatExt && ChatExt.event(L, el)) { scroll(true); }
    }
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return;
        buf += dec.decode(r.value, { stream: true });
        var parts = buf.split('\n\n'); buf = parts.pop();
        parts.forEach(function (p) {
          p = p.trim(); if (p.indexOf('data:') !== 0) return;          // ': ping' heartbeats are ignored
          var j; try { j = JSON.parse(p.slice(5)); } catch (e) { return; }
          onEvent(j);
        });
        return pump();
      });
    }
    return pump();
  }

  function run(url, opts, el, st, retries) {
    S.ctrl = new AbortController();
    return fetch(url, Object.assign({ credentials: 'same-origin', signal: S.ctrl.signal }, opts)).then(function (res) {
      var ct = res.headers.get('Content-Type') || '';
      if (ct.indexOf('application/json') >= 0) return res.json().then(function (j) { st.http = j; });
      return consume(res, el, st);
    }).catch(function (e) {
      if (e && e.name === 'AbortError') { st.aborted = true; return; }
      // connection dropped: the turn keeps running on the server — re-attach and continue where we were
      if (st.turn && retries < 6) {
        return new Promise(function (ok) { setTimeout(ok, 1500 * (retries + 1)); }).then(function () {
          return run('/chat/turn/' + st.turn + '/stream?from=' + st.idx, { method: 'GET' }, el, st, retries + 1);
        });
      }
      st.netError = true;
    });
  }

  function finish(el, st, first) {
    var md = el.querySelector('.md');
    md.classList.remove('cursor'); spin(el, false);
    if (st.http) { S.history.pop(); errBox(el, st.http.error || T('خطا'), st.http.code); }
    else if (st.full) {
      md.innerHTML = MD.render(st.full); S.history.push({ role: 'assistant', content: st.full });
      actions(el, st.full, st.stopped ? T('متوقف شد') : '', true);
    } else if (st.netError) {
      md.innerHTML = '<div class="errbox">' + T('ارتباط قطع شد؛ پاسخ روی سرور کامل می‌شود و با باز کردن دوبارهٔ این گفتگو نمایش داده می‌شود.') + '</div>';
    } else if (!el.querySelector('.errbox') && !el.querySelector('.tbox')) {
      md.innerHTML = st.stopped || st.aborted ? '<span style="color:var(--t3)">' + T('متوقف شد.') + '</span>' : '';
      S.history.pop();
    } else if (!st.full) { md.innerHTML = ''; }
    setBusy(false); S.ctrl = null; S.turn = '';
    if (first && LEMURA.user) App.loadConvs();
    if (window.Chat && Chat.onReply) Chat.onReply(st.full, st.stopped ? 'aborted' : '');
  }

  function send(text, opts) {
    opts = opts || {};
    if (S.busy) { stop(); return; }
    text = (text != null ? text : inp.value).trim();
    var atts = opts.regen ? [] : S.att.filter(function (a) { return a.id; });
    if (S.att.some(function (a) { return !a.id; })) { App.toast(T('صبر کنید تا آپلود فایل تمام شود'), true); return; }
    if (!text && !atts.length) return;
    if (!opts.regen) { inp.value = ''; grow(); S.att = []; renderAtt(); }
    hero(false); ensureConv(text || atts[0].name);
    if (!opts.regen && !opts.followup) addUser(text, atts);
    var el = addAI(S.model);
    var hist = S.history.slice(-20); var first = !S.history.length;
    S.history.push({ role: 'user', content: text });
    setBusy(true);
    var st = { full: '', idx: 0, turn: '' };
    run('/chat/stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, model: S.model, history: hist, conversation_id: LEMURA.user ? S.conv : '', web_search: S.webOn,
        mode: S.creative ? 'creative' : '', tools: Object.keys(S.pinned), attachments: atts.map(function (a) { return a.id; }),
        agent_id: window.ChatExt ? ChatExt.agentId(S.conv) : '', followup: opts.followup || '', voice: !!opts.voice })
    }, el, st, 0).then(function () { finish(el, st, first); });
  }

  // re-attach to a reply that is still being produced on the server (after a reload / reopening the chat)
  function attach(turn, model) {
    var el = addAI(model); setBusy(true);
    var st = { full: '', idx: 0, turn: turn }; S.turn = turn;
    run('/chat/turn/' + turn + '/stream?from=0', { method: 'GET' }, el, st, 0).then(function () {
      if (st.http) { el.remove(); setBusy(false); open(S.conv); return; }      // already finished: reload saved history
      finish(el, st, false);
    });
  }

  function stop() {
    if (S.turn) {            // ask the server to stop the turn; the stream ends with what was produced so far
      App.post('/chat/turn/' + S.turn + '/cancel', {}, true).catch(function () { stopStream(); });
      sendBtn.disabled = true;
      return;
    }
    stopStream();
  }

  function regenerate() {
    if (S.busy) return;
    var lastUser = null, i;
    for (i = S.history.length - 1; i >= 0; i--) if (S.history[i].role === 'user') { lastUser = S.history[i].content; break; }
    if (lastUser == null) return;
    S.history = S.history.slice(0, i);
    var last = msgs.lastElementChild; if (last && last.classList.contains('ai')) last.remove();
    send(lastUser, { regen: true });
  }

  // ---------- attachments ----------
  function renderAtt() {
    var box = $('atts'); if (!box) return;
    box.innerHTML = S.att.map(function (a, i) {
      var thumb = a.kind === 'image' && a.preview ? '<img src="' + a.preview + '" alt="">' : '<span class="fi">' + App.ic('file-text') + '</span>';
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
    plus: function (e) { loadTools(); chips(); App.menu(e, 'plusMenu'); },
    toggleWeb: function () { S.webOn = !S.webOn; chips(); },
    share: function () {
      if (!S.conv || !LEMURA.user) return;
      App.post('/chat/share', { conversation_id: S.conv }, true).then(function (r) {
        if (r.success) navigator.clipboard.writeText(r.data.url).then(function () { App.toast(T('لینک اشتراک کپی شد')); }, function () { prompt(T('لینک:'), r.data.url); });
      });
    }
  };
  loadState().then(function () {
    if (CHAT_INIT.conv && LEMURA.user) open(CHAT_INIT.conv);
    var q = new URLSearchParams(location.search).get('q'); if (q) send(q);
  });
  setBusy(false);
})();
