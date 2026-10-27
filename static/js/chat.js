(function () {
  var model = window.LAC_DEFAULT_MODEL || '', logged = window.LAC_LOGGED;
  var history = [], convId = '', sending = false;
  var msgs = document.getElementById('lacMsgs'), empty = document.getElementById('lacEmpty');
  var text = document.getElementById('lacText'), send = document.getElementById('lacSend');
  var modelBtn = document.getElementById('lacModelBtn'), drop = document.getElementById('lacModelDrop');
  var modelName = document.getElementById('lacModelName'), convsEl = document.getElementById('lacConvs');
  var newBtn = document.getElementById('lacNew'), balEl = document.getElementById('chatBal');

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : s; return d.innerHTML; }
  function renderMd(t) {
    var s = String(t || ''), blocks = [];
    s = s.replace(/```([\w\-]*)\n?([\s\S]*?)```/g, function (m, l, c) { blocks.push(c.replace(/^\n+|\n+$/g, '')); return '\u0000CB' + (blocks.length - 1) + '\u0000'; });
    s = esc(s);
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/\u0000CB(\d+)\u0000/g, function (m, i) { return '<pre><code>' + esc(blocks[+i]) + '</code></pre>'; });
    return s;
  }
  function setModel(m, name) { model = m; modelName.textContent = name || m; }
  if (model) { var first = drop.querySelector('[data-model="' + model + '"]'); if (first) setModel(model, first.querySelector('span').textContent); }
  modelBtn.onclick = function (e) { e.stopPropagation(); drop.classList.toggle('show'); };
  document.addEventListener('click', function (e) { if (!document.getElementById('lacModelWrap').contains(e.target)) drop.classList.remove('show'); });
  drop.querySelectorAll('.lac-mo').forEach(function (o) { o.onclick = function () { setModel(o.dataset.model, o.querySelector('span').textContent); drop.classList.remove('show'); }; });

  text.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 140) + 'px'; });
  text.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } });
  send.onclick = doSend;
  newBtn.onclick = function () { history = []; convId = ''; msgs.innerHTML = ''; msgs.appendChild(empty); empty.style.display = ''; loadConvs(); };

  function addMsg(role, content) {
    empty.style.display = 'none';
    var d = document.createElement('div'); d.className = 'lac-msg ' + role;
    var bubble = role === 'assistant' ? renderMd(content) : esc(content);
    d.innerHTML = (role === 'assistant' ? '<div class="lac-av">AI</div>' : '') + '<div class="lac-bubble">' + bubble + '</div>';
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d.querySelector('.lac-bubble');
  }
  function genId() { return 'c_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6); }
  function saveMsg(role, content) {
    if (!logged || !convId) return;
    var fd = new FormData(); fd.append('conversation_id', convId); fd.append('role', role);
    fd.append('content', content); fd.append('model', model);
    if (role === 'user' && history.length <= 2) fd.append('title', content.substring(0, 50));
    fetch('/chat/save-message', { method: 'POST', body: fd, credentials: 'same-origin' }).then(function () { if (role === 'assistant' && history.length <= 2) setTimeout(loadConvs, 400); });
  }

  function doSend() {
    if (sending) return;
    var msg = text.value.trim(); if (!msg || !model) return;
    sending = true; send.disabled = true;
    addMsg('user', msg); history.push({ role: 'user', content: msg });
    text.value = ''; text.style.height = 'auto';
    if (!convId) convId = genId();
    saveMsg('user', msg);
    var bubble = addMsg('assistant', ''); bubble.innerHTML = '<span class="lac-cursor"></span>';
    fetch('/chat/stream', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ model: model, message: msg, history: history.slice(0, -1) })
    }).then(function (resp) {
      if (!resp.ok) { return resp.json().then(function (j) { throw new Error(mapErr(j.error)); }); }
      var reader = resp.body.getReader(), dec = new TextDecoder(), buf = '', acc = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) { finish(acc); return; }
          buf += dec.decode(r.value, { stream: true });
          var lines = buf.split('\n'); buf = lines.pop();
          lines.forEach(function (line) {
            line = line.trim(); if (line.indexOf('data:') !== 0) return;
            var d = line.slice(5).trim(); if (!d || d === '[DONE]') return;
            try { var j = JSON.parse(d); var delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (delta) { acc += delta; bubble.innerHTML = renderMd(acc) + '<span class="lac-cursor"></span>'; msgs.scrollTop = msgs.scrollHeight; } if (j.error) throw new Error(mapErr(j.error)); } catch (e) { }
          });
          return pump();
        });
      }
      return pump();
    }).then(function () { }).catch(function (e) { bubble.innerHTML = '<span style="color:var(--red)">' + esc(e.message || 'خطا') + '</span>'; sending = false; send.disabled = false; });

    function finish(acc) {
      bubble.innerHTML = renderMd(acc);
      history.push({ role: 'assistant', content: acc });
      saveMsg('assistant', acc);
      fetch('/chat/finalize', { method: 'POST', body: new FormData(), credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) { if (r.data && typeof r.data.new_balance !== 'undefined' && balEl) balEl.textContent = commaNum(r.data.new_balance); }).catch(function () { });
      sending = false; send.disabled = false;
    }
  }
  function mapErr(e) {
    var m = { need_charge: 'برای استفاده از این مدل کیف پول خود را شارژ کنید', insufficient_balance: 'موجودی کافی نیست', free_limit: 'سقف پیام رایگان امروز تمام شد', guest_limit: 'سقف پیام مهمان تمام شد. وارد شوید', guest_model_locked: 'این مدل برای کاربران وارد شده است', guest_disabled: 'برای چت وارد شوید' };
    return m[e] || e || 'خطا';
  }
  function loadConvs() {
    if (!logged) return;
    fetch('/chat/conversations', { method: 'POST', body: new FormData(), credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) {
      if (!r.success) return; convsEl.innerHTML = '';
      (r.data || []).forEach(function (c) {
        var d = document.createElement('div'); d.className = 'lac-conv' + (c.conversation_id === convId ? ' active' : '');
        d.innerHTML = '<span>' + esc(c.title || 'بدون عنوان') + '</span><button data-del>✕</button>';
        d.onclick = function (e) { if (e.target.hasAttribute('data-del')) { delConv(c.conversation_id); return; } loadConv(c.conversation_id); };
        convsEl.appendChild(d);
      });
    });
  }
  function loadConv(cid) {
    var fd = new FormData(); fd.append('conversation_id', cid);
    fetch('/chat/conversation', { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) {
      if (!r.success) return; convId = cid; history = []; msgs.innerHTML = '';
      (r.data || []).forEach(function (m) { history.push({ role: m.role, content: m.content }); if (m.model) model = m.model; addMsg(m.role, m.content); });
      loadConvs();
    });
  }
  function delConv(cid) {
    if (!confirm('حذف گفتگو؟')) return;
    var fd = new FormData(); fd.append('conversation_id', cid);
    fetch('/chat/delete', { method: 'POST', body: fd, credentials: 'same-origin' }).then(function () { if (cid === convId) newBtn.click(); else loadConvs(); });
  }
  loadConvs();
})();
