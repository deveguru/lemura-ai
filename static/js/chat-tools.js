/* Lemura chat — platform tool activity: tool chips, generated files, approval cards (HITL) and async jobs.
   app-chat.js forwards every unknown `lemura` SSE event to ChatExt.event(L, el). */
(function () {
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  var INIT = window.CHAT_INIT || {};
  var agent = INIT.agent || null;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  function box(el) {
    var b = el.querySelector('.tbox');
    if (!b) {
      b = document.createElement('div'); b.className = 'tbox';
      el.querySelector('.bubble').insertBefore(b, el.querySelector('.md'));
    }
    return b;
  }
  function size(n) { n = Number(n || 0); return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function fileCards(files) {
    return (files || []).map(function (f) {
      var img = /^image\//.test(f.mime || '');
      var aud = /^audio\//.test(f.mime || '');
      var vid = /^video\//.test(f.mime || '');
      return '<div class="tfile">' + (img ? '<img src="' + esc(f.url) + '" alt="" onclick="App.lightbox(this.src)">' : '') +
        (aud ? '<audio controls preload="none" src="' + esc(f.url) + '"></audio>' : '') +
        (vid ? '<video controls playsinline preload="metadata" src="' + esc(f.url) + '"></video>' : '') +
        '<a class="tdl" href="' + esc(f.url) + '" target="_blank" rel="noopener" download>' + App.ic('download') + ' ' + esc(f.name) +
        ' <span>' + size(f.size) + '</span></a></div>';
    }).join('');
  }
  function chip(el, tool, name) {
    var c = document.createElement('div'); c.className = 'tchip run'; c.setAttribute('data-tool', tool);
    c.innerHTML = '<span class="tsp"></span><b>' + esc(name || tool) + '</b><span class="tst">' + T('در حال اجرا...') + '</span>';
    box(el).appendChild(c); return c;
  }
  function lastChip(el, tool) {
    var cs = el.querySelectorAll('.tchip.run[data-tool="' + tool + '"]'); return cs[cs.length - 1];
  }
  function done(c, ok, text) {
    if (!c) return; c.classList.remove('run'); c.classList.add(ok ? 'ok' : 'bad');
    c.querySelector('.tsp').innerHTML = ok ? App.ic('check') : '!';
    c.querySelector('.tst').textContent = text || (ok ? T('انجام شد') : T('ناموفق'));
  }

  function confirmCard(el, L) {
    var c = lastChip(el, L.tool); if (c) c.remove();
    var p = L.preview || {};
    var card = document.createElement('div'); card.className = 'tconfirm';
    card.innerHTML = '<div class="th">' + App.ic('shield-check') + ' ' + T('تأیید لازم است') + ' — <b>' + esc(L.name || L.tool) + '</b> <span class="badge ' +
      (p.risk_level === 'destructive' ? 'badge-red' : 'badge-warn') + '">' + esc(p.risk_level === 'destructive' ? T('حذف/تخریبی') : T('تغییر داده')) + '</span></div>' +
      (p.request ? '<div class="treq ltr">' + esc(p.request) + '</div>' : '') +
      '<pre class="ltr">' + esc(JSON.stringify(p.arguments || {}, null, 2)) + '</pre>' +
      (p.code ? '<details><summary>' + T('کد اسکریپتی که اجرا می‌شود') + '</summary><pre class="ltr">' + esc(p.code) + '</pre></details>' : '') +
      '<div class="tact"><button class="btn btn-sm" data-a="1">' + App.ic('circle-check') + ' ' + T('تأیید و اجرا') + '</button>' +
      '<button class="btn btn-sm btn-ghost" data-a="0">' + App.ic('x') + ' ' + T('رد') + '</button></div><div class="tres"></div>';
    box(el).appendChild(card);
    card.querySelectorAll('[data-a]').forEach(function (b) {
      b.onclick = function () {
        var ok = b.getAttribute('data-a') === '1';
        card.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        App.post('/pf/confirm', { token: L.token, approve: ok ? 1 : 0 }, true).then(function (r) {
          var res = card.querySelector('.tres');
          if (!r.ok) { res.innerHTML = '<div class="errbox">' + esc(r.error || T('خطا')) + '</div>'; return; }
          card.classList.add(ok ? 'approved' : 'rejected');
          card.querySelector('.tact').innerHTML = '<span class="badge ' + (ok ? 'badge-green' : 'badge-red') + '">' + (ok ? T('تأیید شد') : T('رد شد')) + '</span>';
          if (ok && r.result) {
            res.innerHTML = (r.result.ok ? '' : '<div class="errbox">' + esc(r.result.error || T('اجرا ناموفق بود')) + '</div>') + fileCards(r.result.files);
            if (r.result.job_id) watchJob(card, r.result.job_id, L.name);
            if (r.balance != null) App.setBalance(r.balance);
          }
          if (window.Chat && Chat.sendText) setTimeout(function () {
            Chat.sendText(ok ? T('تأیید کردم؛ نتیجه را بگو.') : T('این عملیات را رد کردم.'), { followup: r.followup });
          }, 300);
        }).catch(function () { App.toast(T('خطا'), true); card.querySelectorAll('button').forEach(function (x) { x.disabled = false; }); });
      };
    });
  }

  function watchJob(el, jid, name) {
    var host = el.classList && el.classList.contains('tconfirm') ? el : box(el);
    var j = document.createElement('div'); j.className = 'tjob';
    j.innerHTML = '<span class="tsp"></span>' + App.ic('hourglass') + ' ' + esc(name || '') + ' — ' + T('در صف پردازش؛ پس از اتمام اعلان دریافت می‌کنید.') +
      ' <a href="/jobs#' + esc(jid) + '">' + T('پیگیری') + '</a><div class="tjr"></div>';
    host.appendChild(j);
    var tries = 0;
    (function poll() {
      tries++;
      fetch('/pf/jobs/' + encodeURIComponent(jid), { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) {
        var s = (r.job || {}).status;
        if (s === 'succeeded' || s === 'failed') {
          j.classList.add(s === 'succeeded' ? 'ok' : 'bad');
          j.querySelector('.tsp').innerHTML = s === 'succeeded' ? App.ic('check') : '!';
          var res = (r.job || {}).result || {};
          j.querySelector('.tjr').innerHTML = s === 'succeeded' ? fileCards(res.files) +
            (res.data && !(res.files || []).length ? '<pre class="ltr">' + esc(JSON.stringify(res.data, null, 2).slice(0, 4000)) + '</pre>' : '')
            : '<div class="errbox">' + esc((res.error || {}).message || T('کار ناموفق بود')) + '</div>';
          return;
        }
        if (tries < 400) setTimeout(poll, tries < 20 ? 3000 : 8000);
      }).catch(function () { if (tries < 400) setTimeout(poll, 8000); });
    })();
  }

  window.ChatExt = {
    agentId: function (conv) {
      if (agent) { if (conv) store('lemura_agent_' + conv, String(agent.id)); return agent.id; }
      return conv ? (store('lemura_agent_' + conv) || '') : '';
    },
    event: function (L, el) {
      if (L.type === 'tool_start') { chip(el, L.tool, L.name); return true; }
      if (L.type === 'tool_result') {
        var c = lastChip(el, L.tool);
        done(c, L.ok, L.ok ? (L.cost ? T('انجام شد') + ' · ' + Number(L.cost).toLocaleString() + ' ' + T('تومان') : T('انجام شد')) : (L.error || T('ناموفق')));
        if (L.files && L.files.length) { var f = document.createElement('div'); f.className = 'tfiles'; f.innerHTML = fileCards(L.files); box(el).appendChild(f); }
        if (L.balance != null) App.setBalance(L.balance);
        return true;
      }
      if (L.type === 'confirm') { confirmCard(el, L); return true; }
      if (L.type === 'job') { var c2 = lastChip(el, L.tool); done(c2, true, T('در صف')); watchJob(el, L.job_id, L.name); return true; }
      return false;
    }
  };

  // agent conversations: keep the agent bound when an old conversation is reopened
  if (agent) document.title = agent.name + ' — ' + document.title;
})();
