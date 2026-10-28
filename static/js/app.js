/* Lemura app shell: sidebar, menus, toasts, conversation list. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app');
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };
  var mobile = function () { return window.matchMedia('(max-width:860px)').matches; };
  var SVG = function (p) { return '<svg class="ic" viewBox="0 0 24 24">' + p + '</svg>'; };
  var ICON_DOTS = SVG('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>');

  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function num(n) { return Number(n || 0).toLocaleString('en-US'); }
  function faNum(n) { return Number(n || 0).toLocaleString(window.I18N && I18N.lang === 'en' ? 'en-US' : 'fa-IR'); }
  function toast(t, err) {
    var el = $('globalToast'); el.textContent = t; el.classList.toggle('error', !!err); el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }
  function post(url, data, json) {
    var opt = { method: 'POST', credentials: 'same-origin' };
    if (json) { opt.headers = { 'Content-Type': 'application/json' }; opt.body = JSON.stringify(data || {}); }
    else { var fd = new FormData(); for (var k in (data || {})) fd.append(k, data[k]); opt.body = fd; }
    return fetch(url, opt).then(function (r) { return r.json(); });
  }

  // sidebar
  try { if (!mobile() && localStorage.getItem('lm_side') === 'off') app.classList.add('side-off'); } catch (e) {}
  function toggleSide() {
    if (mobile()) { app.classList.toggle('side-open'); return; }
    app.classList.toggle('side-off');
    try { localStorage.setItem('lm_side', app.classList.contains('side-off') ? 'off' : 'on'); } catch (e) {}
  }

  // popup menus
  var openMenu = null;
  function closeMenus() { if (openMenu) { openMenu.classList.remove('open'); openMenu = null; } }
  function menu(ev, id, anchor) {
    ev.stopPropagation();
    var m = typeof id === 'string' ? $(id) : id;
    if (openMenu === m) { closeMenus(); return; }
    closeMenus();
    var r = (anchor || ev.currentTarget).getBoundingClientRect();
    m.classList.add('open'); openMenu = m;
    var w = m.offsetWidth, h = m.offsetHeight;
    var top = r.bottom + 6; if (top + h > innerHeight - 8) top = Math.max(8, r.top - h - 6);
    var left = r.right - w; if (left < 8) left = 8; if (left + w > innerWidth - 8) left = innerWidth - w - 8;
    m.style.top = top + 'px'; m.style.left = left + 'px';
  }
  document.addEventListener('click', function (e) { if (openMenu && !openMenu.contains(e.target)) closeMenus(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMenus(); $('lb').classList.remove('open'); } });

  function lightbox(src) { var lb = $('lb'); lb.querySelector('img').src = src; lb.classList.add('open'); }

  // conversation list
  var convMenu = document.createElement('div'); convMenu.className = 'menu'; document.body.appendChild(convMenu);
  var convCache = [];
  function groupOf(last) {
    var d = new Date(String(last).replace(' ', 'T')); if (isNaN(d)) return T('قدیمی‌تر');
    var days = (Date.now() - d.getTime()) / 864e5;
    return days < 1 ? T('امروز') : days < 2 ? T('دیروز') : days < 7 ? T('۷ روز گذشته') : days < 30 ? T('۳۰ روز گذشته') : T('قدیمی‌تر');
  }
  function renderConvs() {
    var box = $('convs'); if (!box || !LEMURA.user) return;
    var active = App.currentConv || '';
    if (!convCache.length) { box.innerHTML = '<div style="padding:8px 10px;font-size:.8rem;color:var(--t3)">هنوز گفتگویی ندارید.</div>'; return; }
    var html = '', g = '';
    convCache.forEach(function (c) {
      var gg = groupOf(c.last); if (gg !== g) { g = gg; html += '<div class="cgroup">' + g + '</div>'; }
      html += '<div class="conv' + (c.conversation_id === active ? ' active' : '') + '" data-id="' + esc(c.conversation_id) + '">' +
        '<span class="t">' + esc(c.title || T('گفتگوی بدون عنوان')) + '</span>' +
        '<button class="ibtn more" data-more>' + ICON_DOTS + '</button></div>';
    });
    box.innerHTML = html;
  }
  function loadConvs() {
    if (!LEMURA.user) return Promise.resolve();
    return post('/chat/conversations').then(function (r) { convCache = r.data || []; renderConvs(); });
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest && e.target.closest('.conv'); if (!c) return;
    var id = c.getAttribute('data-id');
    if (e.target.closest('[data-more]')) {
      convMenu.innerHTML = '<button data-a="rename">✏️ ' + T('تغییر نام') + '</button><button data-a="share">🔗 ' + T('اشتراک‌گذاری') + '</button>' +
        '<button data-a="drive">☁️ ' + T('ذخیره در گوگل درایو') + '</button><hr><button class="danger" data-a="delete">🗑 ' + T('حذف') + '</button>';
      convMenu.onclick = function (ev) { var a = ev.target.closest('[data-a]'); if (!a) return; closeMenus(); convAction(a.getAttribute('data-a'), id); };
      menu(e, convMenu, e.target.closest('[data-more]')); return;
    }
    if (window.Chat && Chat.open) { Chat.open(id); if (mobile()) app.classList.remove('side-open'); }
    else location.href = '/c/' + encodeURIComponent(id);
  });
  function convAction(a, id) {
    var item = convCache.filter(function (c) { return c.conversation_id === id; })[0] || {};
    if (a === 'drive') { toDrive({ conversation_id: id }); return; }
    if (a === 'rename') {
      var t = prompt('عنوان جدید گفتگو:', item.title || ''); if (!t) return;
      post('/chat/rename', { conversation_id: id, title: t }, true).then(function () { item.title = t; renderConvs(); });
    } else if (a === 'delete') {
      if (!confirm(T('این گفتگو حذف شود؟'))) return;
      post('/chat/delete', { conversation_id: id }, true).then(function () {
        convCache = convCache.filter(function (c) { return c.conversation_id !== id; }); renderConvs();
        if (App.currentConv === id) { if (window.Chat) Chat.reset(); else location.href = '/'; }
        toast('گفتگو حذف شد');
      });
    } else if (a === 'share') {
      post('/chat/share', { conversation_id: id }, true).then(function (r) {
        if (!r.success) return toast('خطا در ساخت لینک', true);
        (navigator.clipboard ? navigator.clipboard.writeText(r.data.url) : Promise.reject()).then(function () { toast('لینک اشتراک کپی شد'); },
          function () { prompt('لینک اشتراک:', r.data.url); });
      });
    }
  }
  function upsertConv(id, title) {
    var ex = convCache.filter(function (c) { return c.conversation_id === id; })[0];
    if (ex) { convCache.splice(convCache.indexOf(ex), 1); ex.last = new Date().toISOString(); convCache.unshift(ex); }
    else convCache.unshift({ conversation_id: id, title: title, last: new Date().toISOString() });
    renderConvs();
  }
  function toDrive(payload) {
    toast(T('در حال ارسال به گوگل درایو...'));
    post('/drive/export', payload, true).then(function (r) {
      if (r.ok) { toast(T('در گوگل درایو ذخیره شد') + ': ' + r.name); return; }
      if (r.code === 'drive_not_connected') { if (confirm((r.error || '') + '\n' + T('اکنون متصل شوید؟'))) location.href = '/drive/connect'; return; }
      toast(r.error || T('خطا'), true);
    }).catch(function () { toast(T('خطا'), true); });
  }
  function setBalance(b) {
    LEMURA.balance = b; var el = $('sideBal'); if (el) el.textContent = faNum(b) + T(' تومان');
  }

  window.App = { toggleSide: toggleSide, menu: menu, closeMenus: closeMenus, toast: toast, post: post, esc: esc, num: num, faNum: faNum,
    lightbox: lightbox, loadConvs: loadConvs, toDrive: toDrive, renderConvs: renderConvs, upsertConv: upsertConv, setBalance: setBalance, currentConv: '' };
  window.lemuraToast = toast; window.commaNum = num;
  loadConvs();
})();
