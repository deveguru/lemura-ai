/* Notification bell: in-app inbox (/pf/notifications) and Web Push opt-in (service worker /sw.js + VAPID). */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };
  var esc = App.esc;
  var items = [];
  var ICON = { job: App.ic('hourglass'), task: App.ic('alarm-clock'), connector: App.ic('library'), warn: App.ic('triangle-alert'), admin: App.ic('shield-check'), api: App.ic('plug') };

  function load() {
    return fetch('/pf/notifications', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) {
      items = r.items || [];
      $('bellDot').hidden = !r.unread;
      $('notifList').innerHTML = items.length ? items.map(function (n) {
        return '<a class="ni ' + (n.is_read ? '' : 'unread') + '" href="' + esc(n.link || '#') + '" data-id="' + n.id + '"><span class="nic">' + (ICON[n.kind] || App.ic('bell')) + '</span>' +
          '<span class="nb"><b>' + esc(n.title) + '</b><small>' + esc((n.body || '').slice(0, 180)) + '</small><i>' + esc(String(n.created_at).replace('T', ' ').slice(0, 16)) + '</i></span></a>';
      }).join('') : '<div class="muted" style="padding:14px;text-align:center">' + T('اعلانی ندارید') + '</div>';
    }).catch(function () {});
  }
  function pushSupported() { return 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext; }
  function b64(s) {
    var p = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }
  var Notif = {
    toggle: function (e) { load(); App.menu(e, 'notifMenu'); },
    readAll: function () { App.post('/pf/notifications/read', {}, true).then(load); },
    push: function () {
      if (!pushSupported()) { App.toast(T('مرورگر شما از اعلان پشتیبانی نمی‌کند'), true); return; }
      Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') { App.toast(T('اجازهٔ اعلان داده نشد'), true); return; }
        return Promise.all([navigator.serviceWorker.register('/sw.js', { scope: '/' }),
          fetch('/pf/push/key', { credentials: 'same-origin' }).then(function (r) { return r.json(); })]).then(function (rs) {
          return navigator.serviceWorker.ready.then(function (reg) {
            return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(rs[1].key) });
          });
        }).then(function (sub) {
          return App.post('/pf/push/subscribe', sub.toJSON(), true);
        }).then(function (r) { App.toast(r && r.ok ? T('اعلان مرورگر فعال شد') : T('خطا'), !(r && r.ok)); $('pushBtn').hidden = true; });
      }).catch(function () { App.toast(T('فعال‌سازی اعلان ناموفق بود'), true); });
    }
  };
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('#notifList .ni');
    if (a) App.post('/pf/notifications/read', { id: a.getAttribute('data-id') }, true);
  });
  if (pushSupported() && window.Notification && Notification.permission !== 'granted') $('pushBtn').hidden = false;
  window.Notif = Notif;
  load(); setInterval(load, 60000);
})();
