/* Agent task page: polls the task, renders the timeline and the approval cards. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };
  var esc = App.esc, id = TASK.id, after = 0, task = null, timer = null;
  var ICON = { note: '💬', tool: '🔎', action: '⚙️', plan: '🗺', report: '✅', error: '⚠️' };
  var TOOL = { list_dir: T('مشاهده پوشه'), read_file: T('خواندن فایل'), write_file: T('نوشتن فایل'), make_dir: T('ساخت پوشه'),
    run_command: T('اجرای دستور'), list_databases: T('فهرست دیتابیس‌ها'), wp_list: T('فهرست وردپرس'), wp_get_post: T('خواندن مطلب'),
    wp_create_post: T('ساخت مطلب'), wp_update_post: T('ویرایش مطلب'), wp_create_term: T('ساخت دسته/برچسب'),
    wp_plugin_toggle: T('تغییر وضعیت افزونه'), fetch_url: T('بررسی صفحه وب'), save_artifact: T('ذخیره فایل تحویلی'),
    site_info: T('اطلاعات سایت'), propose_plan: T('برنامه پیشنهادی'), finish: T('گزارش نهایی') };
  var SCHED = [['', T('فقط یک بار اجرا شود')], ['hourly', T('هر ساعت')], ['daily@09:00', T('هر روز ساعت ۹ صبح')],
    ['daily@21:00', T('هر روز ساعت ۹ شب')], ['weekly@0@09:00', T('هر هفته شنبه ساعت ۹')]];

  function stepHtml(s) {
    var head = '<div class="sh"><span class="si">' + (ICON[s.kind] || '•') + '</span><b>' + esc(TOOL[s.tool] || (s.kind === 'note' ? T('ایجنت') : s.tool || s.kind)) + '</b>' +
      (s.status === 'pending' ? '<span class="badge badge-warn">' + T('منتظر تأیید شما') + '</span>' :
       s.status === 'rejected' ? '<span class="badge badge-red">' + T('رد شد') + '</span>' :
       s.status === 'error' ? '<span class="badge badge-red">' + T('خطا') + '</span>' :
       s.status === 'approved' ? '<span class="badge badge-green">' + T('تأیید شد') + '</span>' : '') +
      '<span class="st">' + esc((s.created_at || '').slice(11, 16)) + '</span></div>';
    var body = '';
    if (s.kind === 'plan' && s.args) {
      var p = s.args;
      body = '<div class="md">' + MD.render(p.summary || '') + '</div><ol class="plist">' + (p.steps || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ol>' +
        ((p.changes || []).length ? '<div class="hint"><b>' + T('تغییراتی که انجام می‌شود') + ':</b><ul>' + p.changes.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') +
        (p.risks ? '<div class="note">⚠️ ' + esc(p.risks) + '</div>' : '');
      if (s.status === 'pending' && task && task.status === 'awaiting_plan') body += planForm();
    } else if (s.kind === 'action') {
      body = '<div class="md">' + MD.render(s.preview || '') + '</div>';
      if (s.status === 'pending' && task && task.status === 'awaiting_action') body +=
        '<div class="appr"><button class="btn btn-sm" data-act="1" data-step="' + s.id + '">✔ ' + T('تأیید و اجرا') + '</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="all" data-step="' + s.id + '">⏩ ' + T('تأیید این و بقیه تغییرات') + '</button>' +
        '<button class="btn btn-sm btn-danger" data-act="0" data-step="' + s.id + '">✖ ' + T('رد') + '</button></div>';
      else if (s.output) body += '<details><summary>' + T('نتیجه') + '</summary><pre class="out">' + esc(s.output) + '</pre></details>';
    } else if (s.kind === 'tool') {
      body = s.output ? '<details><summary>' + T('خروجی') + '</summary><pre class="out">' + esc(s.output) + '</pre></details>' : '';
    } else {
      body = '<div class="md">' + MD.render(s.output || '') + '</div>';
    }
    if (s.artifact) body += '<a class="btn btn-sm" href="' + esc(s.artifact) + '" download>⬇ ' + T('دانلود فایل') + '</a> ' +
      '<button class="btn btn-sm btn-ghost" onclick="App.toDrive({url:\'' + esc(s.artifact) + '\'})">☁️ ' + T('ذخیره در درایو') + '</button>';
    return '<div class="step k-' + s.kind + ' s-' + s.status + '" id="st' + s.id + '">' + head + body + '</div>';
  }
  function planForm() {
    return '<div class="appr plan-appr"><div class="fg"><label>' + T('حالت اجرا') + '</label><select class="input" id="pMode">' +
      '<option value="step"' + (task.mode === 'step' ? ' selected' : '') + '>' + T('تأیید هر تغییر (امن‌تر)') + '</option>' +
      '<option value="auto"' + (task.mode === 'auto' ? ' selected' : '') + '>' + T('اجرای خودکار تمام مراحل') + '</option></select></div>' +
      '<div class="fg"><label>' + T('زمان‌بندی') + '</label><select class="input" id="pSched">' +
      SCHED.map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('') + '</select></div>' +
      '<div class="fg" style="grid-column:1/-1"><label>' + T('توضیح برای ایجنت (اختیاری)') + '</label><input class="input" id="pNote"></div>' +
      '<div style="grid-column:1/-1;display:flex;gap:8px"><button class="btn" data-plan="1">✔ ' + T('تأیید برنامه و شروع') + '</button>' +
      '<button class="btn btn-ghost" data-plan="0">↺ ' + T('اصلاح برنامه') + '</button></div></div>';
  }
  function renderTask(t) {
    task = t;
    var cls = t.status === 'done' ? 'badge-green' : (t.status === 'failed' || t.status === 'cancelled') ? 'badge-red'
      : (t.status.indexOf('awaiting') === 0 || t.status === 'need_charge') ? 'badge-warn' : 'badge-purple';
    $('tStatus').innerHTML = '<span class="badge ' + cls + '">' + esc(T(t.status_label)) + '</span>';
    $('tMode').textContent = '⚙️ ' + (t.mode === 'auto' ? T('اجرای خودکار') : T('تأیید هر تغییر'));
    $('tCost').textContent = '💰 ' + App.faNum(t.cost) + ' ' + T('تومان');
    var msg = t.status_msg || '';
    if (t.status === 'scheduled') msg = T('اجرای بعدی') + ': ' + (t.next_run || '').slice(0, 16);
    if (t.status === 'need_charge') msg = T('موجودی کیف پول کافی نیست؛ پس از شارژ خودکار ادامه می‌یابد.') + ' <a href="/wallet">' + T('شارژ کیف پول') + '</a>';
    $('tMsg').innerHTML = msg; $('tMsg').style.display = msg ? '' : 'none';
    var working = ['planning', 'running'].indexOf(t.status) >= 0;
    $('working').style.display = working ? '' : 'none';
    $('workTxt').textContent = t.status === 'planning' ? T('ایجنت در حال بررسی و برنامه‌ریزی است...') : T('ایجنت در حال اجرای کار است...');
    $('bCancel').style.display = ['done', 'failed', 'cancelled'].indexOf(t.status) >= 0 ? 'none' : '';
    $('followBox').style.display = ['done', 'failed', 'cancelled'].indexOf(t.status) >= 0 && !(t.status === 'cancelled' && t.schedule) ? '' : 'none';
  }
  function poll(full) {
    if (full) { after = 0; $('timeline').innerHTML = ''; }
    fetch('/projects/tasks/' + id + '/poll?after=' + after, { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.ok) return;
      var prevStatus = task && task.status;
      renderTask(d.task); App.setBalance(d.balance);
      if (prevStatus && prevStatus !== d.task.status) { poll(true); return; }  // re-render approval cards
      d.steps.forEach(function (s) { $('timeline').insertAdjacentHTML('beforeend', stepHtml(s)); after = Math.max(after, s.id); });
      if (d.steps.length) window.scrollTo(0, document.body.scrollHeight);
      var fast = ['planning', 'running'].indexOf(d.task.status) >= 0;
      clearTimeout(timer); timer = setTimeout(function () { poll(false); }, fast ? 2000 : 8000);
    }).catch(function () { clearTimeout(timer); timer = setTimeout(function () { poll(false); }, 6000); });
  }
  function act(url, body) {
    return App.post('/projects/tasks/' + id + url, body || {}, true).then(function (r) {
      if (!r.ok) App.toast(r.error || T('خطا'), true); poll(true); return r;
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-plan]');
    if (b) { b.disabled = true; act('/plan', { approve: b.getAttribute('data-plan') === '1', mode: $('pMode').value, schedule: $('pSched').value, note: $('pNote').value }); return; }
    b = e.target.closest('[data-act]');
    if (b) {
      var a = b.getAttribute('data-act'), note = '';
      if (a === '0') { note = prompt(T('دلیل رد (اختیاری) — ایجنت بر اساس آن مسیر را تغییر می‌دهد:')) || ''; }
      if (a === 'all' && !confirm(T('همه تغییرات بعدی این وظیفه بدون پرسش اجرا شوند؟'))) return;
      b.disabled = true; act('/action', { step_id: +b.getAttribute('data-step'), approve: a !== '0', note: note, auto_rest: a === 'all' });
    }
  });
  $('bCancel').onclick = function () { if (confirm(T('این وظیفه لغو شود؟'))) act('/cancel'); };
  $('bFollow').onclick = function () { var v = $('follow').value.trim(); act('/resume', { note: v }); $('follow').value = ''; };
  poll(true);
})();
