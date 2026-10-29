/* Projects page: sites (collapsible cards, tabs, search), connection dialog, new-task dialog. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };
  var esc = App.esc;
  var D = { sites: [], tasks: [], tab: 'all', open: {}, q: '' };
  var KIND = { wordpress: 'WordPress', cpanel: 'cPanel', ssh: 'SSH' };
  var HELP = {
    wordpress: { user: T('نام کاربری وردپرس (مدیر)'), sec: 'Application Password',
      hint: T('در پیشخوان وردپرس: کاربران ← پروفایل ← Application Passwords یک رمز جدید با نام Lemura بسازید و اینجا وارد کنید.') },
    cpanel: { user: T('نام کاربری سی‌پنل'), sec: T('توکن API سی‌پنل'),
      hint: T('در سی‌پنل: Security ← Manage API Tokens ← Create. توکن ساخته‌شده را اینجا وارد کنید. پورت پیش‌فرض 2083 است.') },
    ssh: { user: T('نام کاربری SSH'), sec: T('کلید خصوصی SSH یا رمز عبور'),
      hint: T('کلید خصوصی (OpenSSH/PEM) را کامل وارد کنید؛ بهتر است برای لمورا کلید و کاربر جداگانه بسازید. پورت پیش‌فرض 22 است.') }
  };
  var ACTIVE = ['planning', 'running'], WAIT = ['awaiting_plan', 'awaiting_action', 'need_charge'];

  function load() {
    fetch('/projects/data', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) return;
      D.sites = d.sites; D.tasks = d.tasks; D.labels = d.labels; render();
    });
  }
  function count(st) { return D.tasks.filter(function (t) { return st.indexOf(t.status) >= 0; }).length; }
  function badge(t) {
    var cls = t.status === 'done' ? 'badge-green' : (t.status === 'failed' || t.status === 'cancelled') ? 'badge-red'
      : WAIT.indexOf(t.status) >= 0 ? 'badge-warn' : 'badge-purple';
    return '<span class="badge ' + cls + '">' + esc(T(t.status_label)) + '</span>';
  }
  function taskRow(t) {
    return '<a class="trow" href="/projects/task/' + t.id + '"><span class="tt">' + esc(t.title) + '</span>' +
      (t.schedule ? '<span class="badge">' + App.ic('alarm-clock') + ' ' + esc(t.schedule) + '</span>' : '') + badge(t) +
      '<span class="tm">' + esc((t.updated_at || '').slice(0, 16)) + '</span></a>';
  }
  function render() {
    $('stSites').textContent = App.faNum(D.sites.length);
    $('stActive').textContent = App.faNum(count(ACTIVE) + count(['scheduled']));
    $('stWaiting').textContent = App.faNum(count(['awaiting_plan', 'awaiting_action']));
    $('stDone').textContent = App.faNum(count(['done']));
    // tabs: all + one per site (scrolls when there are many) + general tasks
    var tabs = [{ k: 'all', n: T('همه') + ' (' + App.faNum(D.sites.length) + ')' }];
    D.sites.forEach(function (s) { tabs.push({ k: 's' + s.id, n: s.name, st: s.status }); });
    tabs.push({ k: 'none', n: T('وظایف بدون سایت') });
    $('ptabs').innerHTML = tabs.map(function (t) {
      return '<button class="' + (D.tab === t.k ? 'on' : '') + '" data-tab="' + t.k + '">' +
        (t.st ? '<i class="dot ' + (t.st === 'ok' ? 'ok' : t.st === 'error' ? 'bad' : '') + '"></i>' : '') + esc(t.n) + '</button>';
    }).join('');
    var q = D.q.toLowerCase(), html = '';
    var list = D.sites.filter(function (s) {
      if (D.tab !== 'all' && D.tab !== 's' + s.id) return false;
      if (!q) return true;
      return (s.name + ' ' + s.url).toLowerCase().indexOf(q) >= 0 ||
        D.tasks.some(function (t) { return t.site_id === s.id && t.title.toLowerCase().indexOf(q) >= 0; });
    });
    list.forEach(function (s) {
      var tasks = D.tasks.filter(function (t) { return t.site_id === s.id; });
      var waiting = tasks.filter(function (t) { return ['awaiting_plan', 'awaiting_action'].indexOf(t.status) >= 0; }).length;
      var open = D.open[s.id] || D.tab === 's' + s.id;
      html += '<div class="pcard' + (open ? ' open' : '') + '" data-site="' + s.id + '">' +
        '<div class="phead" data-toggle="' + s.id + '">' +
          '<span class="pkind k-' + s.kind + '">' + KIND[s.kind] + '</span>' +
          '<div class="pname"><b>' + esc(s.name) + '</b><span class="ltr">' + esc(s.url || s.host) + '</span></div>' +
          (waiting ? '<span class="badge badge-warn">' + App.faNum(waiting) + ' ' + T('منتظر تأیید') + '</span>' : '') +
          '<i class="dot ' + (s.status === 'ok' ? 'ok' : s.status === 'error' ? 'bad' : '') + '" title="' + esc(s.status_msg) + '"></i>' +
          '<span class="chev">▾</span></div>' +
        '<div class="pbody">' +
          '<div class="pmeta"><span>' + T('اتصال') + ': <b>' + KIND[s.kind] + '</b></span><span class="ltr">' + esc(s.username + '@' + (s.host || '')) + '</span>' +
          (s.root ? '<span class="ltr">' + esc(s.root) + '</span>' : '') +
          '<span class="' + (s.status === 'error' ? 'bad' : 'okt') + '">' + esc(s.status_msg || T('هنوز تست نشده')) + '</span></div>' +
          '<div class="pacts"><button class="btn btn-sm" data-newtask="' + s.id + '">' + App.ic('bot') + ' ' + T('وظیفه جدید') + '</button>' +
          '<button class="btn btn-sm btn-ghost" data-test="' + s.id + '">' + App.ic('plug') + ' ' + T('تست اتصال') + '</button>' +
          '<button class="btn btn-sm btn-ghost" data-edit="' + s.id + '">' + App.ic('pencil') + ' ' + T('ویرایش') + '</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + s.id + '">' + App.ic('trash-2') + '</button></div>' +
          '<div class="psec">' + T('گزارش کارها') + '</div>' +
          (tasks.length ? tasks.map(taskRow).join('') : '<div class="hint">' + T('هنوز وظیفه‌ای برای این سایت ثبت نشده است.') + '</div>') +
        '</div></div>';
    });
    if (D.tab === 'all' || D.tab === 'none') {
      var general = D.tasks.filter(function (t) { return !t.site_id && (!q || t.title.toLowerCase().indexOf(q) >= 0); });
      if (general.length || D.tab === 'none') html += '<div class="pcard open"><div class="phead"><span class="pkind">' + App.ic('bot') + '</span><div class="pname"><b>' +
        T('وظایف بدون سایت') + '</b><span>' + T('تحقیق، نوشتن و ساخت فایل تحویلی') + '</span></div></div><div class="pbody">' +
        (general.length ? general.map(taskRow).join('') : '<div class="hint">—</div>') + '</div></div>';
    }
    if (!D.sites.length && !D.tasks.length) html = '<div class="panel empty"><div style="font-size:2.4rem">' + App.ic('globe') + '</div><h3>' +
      T('هنوز وب‌سایتی اضافه نکرده‌اید') + '</h3><p class="sub">' + T('اولین سایت خود را با وردپرس، سی‌پنل یا SSH وصل کنید.') +
      '</p><button class="btn" onclick="P.editSite()">' + App.ic('plus') + ' ' + T('افزودن وب‌سایت') + '</button></div>';
    $('plist').innerHTML = html;
  }
  document.addEventListener('click', function (e) {
    var b;
    if ((b = e.target.closest('[data-tab]'))) { D.tab = b.getAttribute('data-tab'); render(); return; }
    if ((b = e.target.closest('[data-toggle]'))) { var id = b.getAttribute('data-toggle'); D.open[id] = !D.open[id]; render(); return; }
    if ((b = e.target.closest('[data-newtask]'))) { newTask(+b.getAttribute('data-newtask')); return; }
    if ((b = e.target.closest('[data-edit]'))) { editSite(+b.getAttribute('data-edit')); return; }
    if ((b = e.target.closest('[data-test]'))) {
      b.disabled = true; App.post('/projects/sites/' + b.getAttribute('data-test') + '/test').then(function (r) {
        App.toast(r.message || r.error, r.status !== 'ok'); load(); });
      return;
    }
    if ((b = e.target.closest('[data-del]'))) {
      if (!confirm(T('این وب‌سایت و اطلاعات اتصال آن حذف شود؟ گزارش وظایف باقی می‌ماند.'))) return;
      App.post('/projects/sites/' + b.getAttribute('data-del') + '/delete').then(function (r) {
        if (!r.ok) App.toast(r.error, true); load(); });
    }
  });
  $('psearch').addEventListener('input', function () { D.q = this.value; render(); });

  // ----- site dialog
  var form = $('siteForm');
  function setKind(k) {
    form.kind.value = k;
    document.querySelectorAll('#kindSeg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-k') === k); });
    document.querySelectorAll('.kf').forEach(function (el) { el.style.display = el.getAttribute('data-for').split(' ').indexOf(k) >= 0 ? '' : 'none'; });
    $('userLbl').textContent = HELP[k].user; $('secLbl').textContent = HELP[k].sec; $('secHint').textContent = HELP[k].hint;
    form.secret.rows = k === 'ssh' ? 6 : 2;
  }
  document.querySelectorAll('#kindSeg button').forEach(function (b) { b.onclick = function () { setKind(b.getAttribute('data-k')); }; });
  function editSite(id) {
    var s = D.sites.filter(function (x) { return x.id === id; })[0];
    form.reset(); form.id.value = s ? s.id : ''; $('siteMsg').className = 'amsg';
    $('siteTitle').textContent = s ? T('ویرایش وب‌سایت') : T('افزودن وب‌سایت');
    if (s) { form.name.value = s.name; form.url.value = s.url; form.host.value = s.host; form.port.value = s.port || '';
      form.username.value = s.username; form.root.value = s.root || ''; form.secret.placeholder = T('برای تغییر، مقدار جدید وارد کنید (فعلی ذخیره شده است)'); }
    else form.secret.placeholder = '';
    setKind(s ? s.kind : 'wordpress'); $('siteModal').classList.add('open');
  }
  form.onsubmit = function (e) {
    e.preventDefault(); var btn = form.querySelector('[type=submit]'); btn.disabled = true;
    var m = $('siteMsg'); m.className = 'amsg ok'; m.textContent = T('در حال ذخیره و تست اتصال...');
    fetch('/projects/sites/save', { method: 'POST', body: new FormData(form), credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { m.className = 'amsg err'; m.textContent = r.error; return; }
      m.className = 'amsg ' + (r.status === 'ok' ? 'ok' : 'err'); m.textContent = r.message;
      form.id.value = r.id; form.secret.value = ''; load();
      if (r.status === 'ok') setTimeout(function () { close('siteModal'); D.tab = 's' + r.id; render(); }, 1200);
    }).catch(function () { btn.disabled = false; m.className = 'amsg err'; m.textContent = T('خطای ارتباط با سرور'); });
  };

  // ----- task dialog
  function newTask(siteId) {
    $('tSite').innerHTML = '<option value="">' + T('بدون سایت (فقط تحقیق و فایل تحویلی)') + '</option>' +
      D.sites.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + ' — ' + KIND[s.kind] + '</option>'; }).join('');
    $('tSite').value = siteId || (D.tab.charAt(0) === 's' ? D.tab.slice(1) : (D.sites[0] ? D.sites[0].id : ''));
    $('taskMsg').className = 'amsg'; $('taskModal').classList.add('open'); setTimeout(function () { $('tGoal').focus(); }, 50);
  }
  document.querySelectorAll('#tpls [data-t]').forEach(function (b) { b.onclick = function () { $('tGoal').value = b.getAttribute('data-t'); $('tGoal').focus(); }; });
  $('tGo').onclick = function () {
    var btn = this; btn.disabled = true;
    App.post('/projects/tasks/create', { site_id: $('tSite').value, goal: $('tGoal').value, model: $('tModel').value, mode: $('tMode').value }, true).then(function (r) {
      btn.disabled = false;
      if (!r.ok) { var m = $('taskMsg'); m.className = 'amsg err'; m.textContent = r.error; return; }
      location.href = '/projects/task/' + r.id;
    }).catch(function () { btn.disabled = false; });
  };
  function close(id) { $(id).classList.remove('open'); }
  window.P = { editSite: function (id) { editSite(id); }, newTask: function (id) { newTask(id); }, close: close };
  load(); setInterval(load, 15000);
})();
