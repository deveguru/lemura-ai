/* Developer docs helpers (/docs, /tools, /developers):
   - a "copy" button on every docs section (clean text: headings, lists, tables, code blocks),
   - "download full docs" as one .txt file,
   - the shared API-key manager (list / copy / create / enable-disable / delete). */
(function () {
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };
  var $ = function (id) { return document.getElementById(id); };

  // ---------- DOM -> readable text ----------
  function textOf(node) {
    var out = [];
    function walk(n) {
      if (n.nodeType === 3) { out.push(n.nodeValue.replace(/\s+/g, ' ')); return; }
      if (n.nodeType !== 1) return;
      var tag = n.tagName.toLowerCase();
      if (n.hasAttribute('data-doc-skip') || n.classList.contains('dcopy') || n.classList.contains('cbar') || n.classList.contains('lang') ||
          tag === 'button' || tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (n.classList.contains('dlurl')) { out.push('\n' + T('لینک دانلود') + ': ' + n.textContent.trim() + '\n'); return; }
      if (tag === 'pre') { out.push('\n```\n' + n.textContent.replace(/\n+$/, '') + '\n```\n'); return; }
      if (tag === 'table') {
        out.push('\n');
        n.querySelectorAll('tr').forEach(function (tr) {
          var cells = []; tr.querySelectorAll('th,td').forEach(function (c) { cells.push(c.textContent.replace(/\s+/g, ' ').trim()); });
          out.push('| ' + cells.join(' | ') + ' |\n');
        });
        out.push('\n'); return;
      }
      if (/^h[1-6]$/.test(tag)) { out.push('\n\n' + '#'.repeat(+tag[1]) + ' ' + n.textContent.replace(/\s+/g, ' ').trim() + '\n'); return; }
      if (tag === 'li') { out.push('\n- '); }
      if (tag === 'br') { out.push('\n'); return; }
      if (tag === 'a' && n.getAttribute('href') && /^(https?:|\/)/.test(n.getAttribute('href')) && !n.querySelector('*')) {
        var href = n.getAttribute('href'); if (href.charAt(0) === '/') href = location.origin + href;
        out.push(n.textContent.trim() + (n.textContent.trim() === href ? '' : ' (' + href + ')')); return;
      }
      var block = /^(p|div|section|article|ul|ol|details|summary|nav)$/.test(tag);
      if (block) out.push('\n');
      for (var c = n.firstChild; c; c = c.nextSibling) walk(c);
      if (block) out.push('\n');
    }
    walk(node);
    return out.join('').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  function copy(text) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { App.toast(T('در کلیپ‌بورد کپی شد')); }, function () {
      var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); App.toast(T('در کلیپ‌بورد کپی شد')); } catch (e) { App.toast(T('کپی ناموفق بود'), true); }
      ta.remove();
    });
  }

  // ---------- per-section copy buttons ----------
  var sections = document.querySelectorAll('.dsec, .tdoc, [data-doc-title], .dldl');
  sections.forEach(function (sec) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'dcopy'; b.title = T('کپی کامل این بخش');
    b.innerHTML = App.ic('copy') + '<span>' + T('کپی این بخش') + '</span>';
    b.onclick = function () { copy(textOf(sec)); };
    sec.insertBefore(b, sec.firstChild);
  });

  // ---------- full download ----------
  var dl = $('docsDl');
  if (dl) dl.onclick = function () {
    var h1 = document.querySelector('.page h1'), parts = [];
    parts.push((h1 ? h1.textContent.trim() : document.title) + '\n' + location.href + '\n' + new Date().toISOString().slice(0, 10));
    var box = document.querySelector('.devbox'); if (box) parts.push(textOf(box));
    sections.forEach(function (sec) { parts.push(textOf(sec)); });
    var blob = new Blob(['﻿' + parts.join('\n\n' + '─'.repeat(60) + '\n\n')], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'lemura-' + (location.pathname.replace(/\W+/g, '') || 'docs') + '-docs.txt';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  // ---------- shared API key manager ----------
  var km = $('keyman');
  function keys() {
    fetch('/pf/api-tokens', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) {
      if (!r.ok) return;
      if ($('devBal')) $('devBal').textContent = App.faNum(r.balance);
      $('kmCount').textContent = '(' + App.faNum(r.tokens.length) + ')';
      $('kmList').innerHTML = r.tokens.length ? r.tokens.map(function (t) {
        return '<div class="kmrow' + (t.active ? '' : ' off') + '"><b>' + App.esc(t.name) + '</b>' +
          '<code class="ltr">' + App.esc(t.key.slice(0, 8)) + '…' + App.esc(t.key.slice(-4)) + '</code>' +
          '<span class="muted">' + App.faNum(t.requests) + ' ' + T('درخواست') + ' · ' + App.faNum(t.cost) + ' ' + T('تومان') + '</span>' +
          '<span class="kmb"><button type="button" class="btn btn-sm btn-ghost" data-k="copy" data-v="' + App.esc(t.key) + '" title="' + T('کپی کلید') + '">' + App.ic('copy') + '</button>' +
          '<button type="button" class="btn btn-sm btn-ghost" data-k="toggle" data-id="' + t.id + '">' + (t.active ? T('غیرفعال') : T('فعال')) + '</button>' +
          '<button type="button" class="btn btn-sm btn-danger" data-k="delete" data-id="' + t.id + '" title="' + T('حذف') + '">' + App.ic('trash-2') + '</button></span></div>';
      }).join('') : '<div class="muted">' + T('هنوز کلیدی نساخته‌اید.') + '</div>';
    });
  }
  if (km) {
    km.addEventListener('toggle', function () { if (km.open) keys(); });
    keys();
    $('kmList').addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]'); if (!b) return;
      var k = b.getAttribute('data-k');
      if (k === 'copy') { copy(b.getAttribute('data-v')); return; }
      if (k === 'delete' && !confirm(T('این کلید حذف شود؟ برنامه‌هایی که از آن استفاده می‌کنند دیگر کار نمی‌کنند.'))) return;
      App.post('/panel/api/token-' + k, { token_id: b.getAttribute('data-id') }).then(function (r) {
        if (!r.success) App.toast((r.data && r.data.msg) || T('خطا'), true); keys();
      });
    });
    $('kmCreate').onclick = function () {
      var n = $('kmName').value.trim(); if (!n) { App.toast(T('نام کلید را وارد کنید'), true); return; }
      var btn = this; btn.disabled = true;
      App.post('/panel/api/token-create', { token_name: n }).then(function (r) {
        btn.disabled = false;
        if (!r.success) { App.toast((r.data && r.data.msg) || T('خطا'), true); return; }
        $('kmName').value = ''; copy(r.data.token_key); App.toast(T('کلید ساخته و در کلیپ‌بورد کپی شد')); keys();
      });
    };
  }
})();
