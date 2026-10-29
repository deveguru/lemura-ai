/* Lemura platform pages: integrations, connector library, scheduled tasks, custom agents, jobs, usage. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };
  var esc = App.esc, num = App.faNum;
  var root = document.querySelector('[data-pf]');
  var page = root ? root.getAttribute('data-pf') : '';

  function get(url) { return fetch(url, { credentials: 'same-origin' }).then(function (r) { return r.json(); }); }
  function post(url, data) { return App.post(url, data || {}, true); }
  function postForm(url, form) {
    return fetch(url, { method: 'POST', credentials: 'same-origin', body: new FormData(form) }).then(function (r) { return r.json(); });
  }
  function open(id) { $(id).classList.add('open'); }
  function close(id) { $(id).classList.remove('open'); }
  document.addEventListener('click', function (e) { if (e.target.classList && e.target.classList.contains('modal-ov')) e.target.classList.remove('open'); });
  function seg(id, attr, cb) {
    var s = $(id); if (!s) return;
    s.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      s.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b); });
      cb(b.getAttribute(attr));
    });
  }
  function setSeg(id, attr, v) { var s = $(id); if (s) s.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x.getAttribute(attr) === v); }); }
  function when(s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; }
  var STATUS = {
    draft: ['badge-warn', 'پیش‌نویس'], testing: ['badge-warn', 'در حال تست'], live: ['badge-green', 'زنده'], failed: ['badge-red', 'تست ناموفق'],
    needs_reauth: ['badge-red', 'نیاز به کلید جدید'], needs_approval: ['badge-warn', 'منتظر تأیید'], paused: ['', 'متوقف'],
    active: ['badge-green', 'فعال'], completed: ['badge-purple', 'تمام‌شده'], queued: ['badge-warn', 'در صف'], running: ['badge-warn', 'در حال اجرا'],
    succeeded: ['badge-green', 'موفق'], pending: ['badge-warn', 'در انتظار بازبینی'], published: ['badge-green', 'منتشرشده'],
    rejected: ['badge-red', 'ردشده'], degraded: ['badge-red', 'ناپایدار'], delisted: ['badge-red', 'حذف از کتابخانه'], ok: ['badge-green', 'موفق'],
    error: ['badge-red', 'خطا'], partial: ['badge-warn', 'ناقص'], disabled: ['', 'غیرفعال']
  };
  function badge(s) { var b = STATUS[s] || ['', s]; return '<span class="badge ' + b[0] + '">' + esc(T(b[1])) + '</span>'; }
  function testBox(t) {
    if (!t) return '';
    return '<div class="' + (t.ok ? 'okbox' : 'errbox') + '">' + (t.ok ? App.ic('circle-check') + ' ' : App.ic('triangle-alert') + ' ') + esc(t.message || '') +
      (t.sample ? '<details><summary>' + T('نمونهٔ پاسخ') + '</summary><pre class="ltr">' + esc(t.sample) + '</pre></details>' : '') + '</div>';
  }

  // ====================================================== integrations
  var I = {
    list: [],
    load: function () {
      get('/pf/connections').then(function (r) {
        I.list = r.connections || [];
        var el = $('connList');
        if (!I.list.length) {
          el.innerHTML = '<div class="panel empty"><div style="font-size:2.2rem">' + App.ic('plug') + '</div><h3 style="justify-content:center">' + T('هنوز اتصالی نساخته‌اید') + '</h3>' +
            '<p class="hint">' + T('یک فایل OpenAPI (برای آزمایش: https://httpbin.org/spec.json) یا مستندات یک سرویس را اضافه کنید.') + '</p>' +
            '<button class="btn" onclick="PF.I.add()">' + App.ic('plus') + ' ' + T('اتصال جدید') + '</button> <a class="btn btn-ghost" href="/library">' + App.ic('library') + ' ' + T('یا از کتابخانه فعال کنید') + '</a></div>';
          return;
        }
        el.innerHTML = '<div class="grid g2">' + I.list.map(function (c) {
          return '<div class="panel ccard"><div class="ch"><span class="cic">' + (c.icon ? esc(c.icon) : (c.kind === 'docs' ? App.ic('file-text') : App.ic('link'))) + '</span><div style="min-width:0;flex:1"><b>' + esc(c.name) + '</b>' +
            '<div class="ltr muted cu">' + esc(c.base_url) + '</div></div>' + badge(c.status) + '</div>' +
            (c.status_msg ? '<div class="hint">' + esc(c.status_msg) + '</div>' : '') +
            '<div class="cm"><span>' + (c.kind === 'docs' ? T('مستندات') : 'OpenAPI') + '</span><span>' + num(c.tools) + ' ' + T('ابزار') + '</span>' +
            (c.credential ? '<span class="ltr">' + App.ic('lock') + ' ' + esc(c.credential.hint) + '</span>' : '') + (c.connector_id ? '<span>' + App.ic('library') + ' ' + T('از کتابخانه') + '</span>' : '') +
            '<span>' + T('تست:') + ' ' + when(c.last_test_at) + '</span></div>' +
            '<div class="cact"><button class="btn btn-sm" onclick="PF.I.test(' + c.id + ',this)">' + App.ic('flask-conical') + ' ' + T('تست اتصال') + '</button>' +
            '<button class="btn btn-sm btn-ghost" onclick="PF.I.tools(' + c.id + ')">' + App.ic('wrench') + ' ' + T('ابزارها') + '</button>' +
            '<button class="btn btn-sm btn-ghost" onclick="PF.I.edit(' + c.id + ')">' + App.ic('pencil') + '</button>' +
            (c.status === 'live' ? '<a class="btn btn-sm btn-ghost" href="/tasks?tool=' + encodeURIComponent('') + '&conn=' + c.id + '">' + App.ic('alarm-clock') + ' ' + T('زمان‌بندی') + '</a>' : '') +
            (c.status === 'live' && !c.connector_id ? '<button class="btn btn-sm btn-ghost" onclick="PF.I.pub(' + c.id + ')">' + App.ic('globe') + ' ' + T('انتشار') + '</button>' : '') +
            '<button class="btn btn-sm btn-danger" onclick="PF.I.del(' + c.id + ')">' + App.ic('trash-2') + '</button></div></div>';
        }).join('') + '</div>';
      });
    },
    kind: function (k) {
      document.querySelector('#connForm [name=kind]').value = k;
      document.querySelectorAll('#connForm [data-kind]').forEach(function (d) { d.hidden = d.getAttribute('data-kind') !== k; });
    },
    src: function (s) { document.querySelectorAll('#connForm [data-src]').forEach(function (d) { d.hidden = d.getAttribute('data-src') !== s; }); },
    authUI: function () {
      var t = document.querySelector('#connForm [name=auth_type]').value;
      $('authName').style.display = (t === 'header' || t === 'query') ? '' : 'none';
    },
    add: function () {
      var f = $('connForm'); f.reset(); f.id.value = ''; $('connTitle').textContent = T('اتصال جدید'); $('connResult').innerHTML = '';
      setSeg('kindSeg', 'data-k', 'openapi'); I.kind('openapi'); setSeg('srcSeg', 'data-s', 'url'); I.src('url'); I.authUI(); open('connModal');
    },
    edit: function (id) {
      var c = I.list.filter(function (x) { return x.id === id; })[0]; if (!c) return;
      I.add(); var f = $('connForm');
      $('connTitle').textContent = T('ویرایش اتصال'); f.id.value = c.id; f.name.value = c.name; f.base_url.value = c.base_url;
      f.description.value = c.description || ''; setSeg('kindSeg', 'data-k', c.kind); I.kind(c.kind);
      f.auth_type.value = (c.auth || {}).type || ''; f.auth_name.value = (c.auth || {}).name || ''; I.authUI();
    },
    save: function (e) {
      e.preventDefault();
      var f = $('connForm'), btn = $('connSave'); btn.disabled = true; $('connResult').innerHTML = '<div class="hint">' + App.ic('hourglass') + ' ' + T('در حال پردازش و تست اتصال...') + '</div>';
      postForm('/pf/connections' + (f.id.value ? '/' + f.id.value : ''), f).then(function (r) {
        btn.disabled = false;
        if (!r.ok) { $('connResult').innerHTML = '<div class="errbox">' + esc(r.error) + '</div>'; return; }
        f.id.value = r.connection.id;
        $('connResult').innerHTML = '<div class="hint">' + num(r.tools) + ' ' + T('ابزار ساخته شد.') + ' ' + esc((r.warnings || []).join(' ')) + '</div>' + testBox(r.test) +
          (r.test && !r.test.ok ? '<div class="hint">' + T('می‌توانید از «ابزارها» یک عملیات خواندنی دیگر را برای تست انتخاب کنید.') + '</div>' : '');
        I.load();
      }).catch(function () { btn.disabled = false; $('connResult').innerHTML = '<div class="errbox">' + T('خطای ارتباط') + '</div>'; });
      return false;
    },
    test: function (id, btn) {
      if (btn) btn.disabled = true;
      post('/pf/connections/' + id + '/test').then(function (r) {
        if (btn) btn.disabled = false;
        var t = r.test || {}; App.toast(t.message || r.error || T('انجام شد'), !t.ok); I.load();
      });
    },
    tools: function (id) {
      get('/pf/connections/' + id).then(function (r) {
        if (!r.ok) { App.toast(r.error, true); return; }
        var c = r.connection;
        $('toolsTitle').innerHTML = App.ic('wrench') + ' ' + esc(c.name);
        var pub = r.published ? '<div class="hint">' + App.ic('globe') + ' ' + T('وضعیت انتشار:') + ' ' + badge(r.published.status) + (r.published.review_note ? ' — ' + esc(r.published.review_note) : '') + '</div>' : '';
        $('toolsBody').innerHTML = pub + '<p class="hint">' + T('این ابزارها در چت به‌صورت خودکار در دسترس مدل هستند. عملیات تغییردهنده (POST/PUT/DELETE) همیشه پیش از اجرا تأیید شما را می‌خواهند.') + '</p>' +
          '<div class="tw"><table class="tbl"><thead><tr><th>' + T('عملیات') + '</th><th>' + T('ریسک') + '</th><th>' + T('نسخه') + '</th><th></th></tr></thead><tbody>' +
          r.tools.map(function (t) {
            var op = t.operation || {};
            return '<tr><td><b>' + esc(t.name) + '</b><div class="ltr mono muted" style="font-size:.72rem">' + esc((op.method || '') + ' ' + (op.path || '')) + ' · ' + esc(t.tool_id) + '</div></td>' +
              '<td>' + (t.risk_level === 'read' ? '<span class="badge badge-green">read</span>' : t.risk_level === 'write' ? '<span class="badge badge-warn">write</span>' : '<span class="badge badge-red">destructive</span>') + '</td>' +
              '<td class="ltr">' + esc(t.version) + '</td><td>' +
              ((t.risk_level === 'read' || c.kind === 'docs') ? '<button class="btn btn-sm btn-ghost" onclick="PF.I.testOp(' + id + ',\'' + t.tool_id + '\')">' + (c.test_tool === t.tool_id ? App.ic('check') + ' ' : '') + T('تست با این') + '</button>' : '') +
              '</td></tr>';
          }).join('') + '</tbody></table></div>';
        open('toolsModal');
      });
    },
    testOp: function (id, tool) {
      var args = prompt(T('ورودی‌های تست (JSON):'), '{}'); if (args === null) return;
      post('/pf/connections/' + id + '/test-op', { tool_id: tool, args: args }).then(function (r) {
        var t = r.test || {}; App.toast(t.message || r.error, !(t.ok)); I.load(); I.tools(id);
      });
    },
    pub: function (id) {
      var c = I.list.filter(function (x) { return x.id === id; })[0] || {}; var f = $('pubForm');
      f.id.value = id; f.name.value = c.name || ''; f.description.value = c.description || ''; f.icon.value = c.icon || ''; open('pubModal');
    },
    publish: function (e) {
      e.preventDefault(); var f = $('pubForm');
      post('/pf/connections/' + f.id.value + '/publish', { name: f.name.value, description: f.description.value, category: f.category.value, icon: f.icon.value }).then(function (r) {
        if (!r.ok) { App.toast(r.error, true); return; }
        close('pubModal'); App.toast(T('برای بازبینی ارسال شد؛ پس از تأیید در کتابخانه منتشر می‌شود.'));
      });
      return false;
    },
    del: function (id) {
      if (!confirm(T('این اتصال، ابزارهایش و کلید ذخیره‌شده حذف شوند؟ وظایف زمان‌بندی‌شدهٔ آن دیگر اجرا نمی‌شوند.'))) return;
      post('/pf/connections/' + id + '/delete').then(function () { I.load(); });
    }
  };

  // ====================================================== library
  var L = {
    cat: '', items: [],
    load: function () {
      get('/pf/library?q=' + encodeURIComponent(($('libq') || {}).value || '') + '&category=' + encodeURIComponent(L.cat)).then(function (r) {
        L.items = r.items || [];
        $('libList').innerHTML = L.items.length ? L.items.map(function (k) {
          var auth = (k.auth || {}).type || 'none';
          return '<div class="panel kcard"><div class="ch"><span class="cic">' + (/^https?:/.test(k.icon || '') ? '<img src="' + esc(k.icon) + '" alt="">' : (k.icon ? esc(k.icon) : App.ic('link'))) + '</span>' +
            '<div style="min-width:0;flex:1"><b>' + esc(k.name) + '</b><div class="muted" style="font-size:.74rem">' + esc(k.category_label) + ' · ' + T('توسط') + ' ' + esc(k.author) + '</div></div></div>' +
            '<p class="hint kd">' + esc((k.description || '').slice(0, 220)) + '</p>' +
            '<div class="cm"><span>' + App.ic('zap') + ' ' + num(k.activations) + ' ' + T('فعال‌سازی') + '</span>' + (k.success_rate != null ? '<span>' + App.ic('check') + ' ' + k.success_rate + '%</span>' : '') +
            (k.operations ? '<span>' + num(k.operations) + ' ' + T('عملیات') + '</span>' : '') + '<span class="ltr">' + esc(auth) + '</span><span>v' + k.version + '</span></div>' +
            '<div class="cact">' + (k.activated ? badge(k.activated.status) + ' <a class="btn btn-sm btn-ghost" href="/integrations">' + T('مدیریت') + '</a>' :
              '<button class="btn btn-sm" onclick="PF.L.act(' + k.id + ')">' + App.ic('zap') + ' ' + T('فعال‌سازی') + '</button>') +
            '<button class="btn btn-sm btn-ghost" onclick="PF.L.rep(' + k.id + ')">' + App.ic('bug') + '</button></div></div>';
        }).join('') : '<div class="panel empty muted">' + T('کانکتوری پیدا نشد. اولین نفری باشید که اتصالش را منتشر می‌کند!') + '</div>';
      });
    },
    act: function (id) {
      var k = L.items.filter(function (x) { return x.id === id; })[0]; if (!k) return;
      var f = $('actForm'); f.reset(); f.id.value = id; $('actTitle').innerHTML = App.ic('zap') + ' ' + esc(k.name); $('actDesc').textContent = k.description || '';
      $('actAuth').style.display = ((k.auth || {}).type || 'none') === 'none' ? 'none' : ''; $('actResult').innerHTML = ''; open('actModal');
    },
    activate: function (e) {
      e.preventDefault(); var f = $('actForm'); $('actResult').innerHTML = '<div class="hint">' + App.ic('hourglass') + ' ' + T('در حال فعال‌سازی و تست...') + '</div>';
      post('/pf/library/' + f.id.value + '/activate', { secret: f.secret.value }).then(function (r) {
        $('actResult').innerHTML = r.ok ? testBox(r.test) : '<div class="errbox">' + esc(r.error) + '</div>'; L.load();
      });
      return false;
    },
    rep: function (id) { var f = $('repForm'); f.reset(); f.id.value = id; open('repModal'); },
    report: function (e) {
      e.preventDefault(); var f = $('repForm');
      post('/pf/library/' + f.id.value + '/report', { message: f.message.value }).then(function (r) {
        App.toast(r.ok ? T('گزارش ارسال شد') : r.error, !r.ok); if (r.ok) close('repModal');
      });
      return false;
    }
  };

  // ====================================================== tasks
  var Tk = {
    list: [], tools: [], current: null,
    load: function () {
      get('/pf/tasks').then(function (r) {
        Tk.list = r.tasks || [];
        var el = $('taskList');
        if (!Tk.list.length) { el.innerHTML = '<div class="panel empty"><div style="font-size:2.2rem">' + App.ic('alarm-clock') + '</div><p class="hint">' + T('هنوز وظیفه‌ای ندارید. یک API زنده یا ابزار را زمان‌بندی کنید.') + '</p><button class="btn" onclick="PF.T.edit()">' + App.ic('plus') + ' ' + T('وظیفهٔ جدید') + '</button></div>'; return; }
        el.innerHTML = Tk.list.map(function (t) {
          var on = t.state === 'active';
          return '<div class="panel tcard" id="' + esc(t.id) + '"><div class="ch"><label class="sw" title="' + T('فعال / متوقف') + '"><input type="checkbox" ' + (on ? 'checked' : '') +
            ' onchange="PF.T.toggle(\'' + t.id + '\',this)" ' + (t.state === 'needs_approval' || t.state === 'completed' ? 'disabled' : '') + '><span></span></label>' +
            '<div style="min-width:0;flex:1"><b>' + esc(t.name) + '</b><div class="muted" style="font-size:.75rem">' + esc(t.tool.name) + ' · <span class="ltr">' + esc(Tk.trgText(t.trigger)) + '</span></div></div>' + badge(t.state) + '</div>' +
            (t.state_msg ? '<div class="hint" style="color:var(--warn)">' + esc(t.state_msg) + '</div>' : '') +
            '<div class="cm"><span>' + T('اجرای بعدی:') + ' ' + when(t.next_run) + '</span><span>' + T('آخرین اجرا:') + ' ' + when(t.last_run) + '</span><span>' + num(t.runs) + ' ' + T('اجرا') + '</span>' +
            (t.tool.risk_level && t.tool.risk_level !== 'read' ? '<span class="badge badge-warn">' + esc(t.tool.risk_level) + '</span>' : '') + '</div>' +
            '<div class="cact">' + (t.state === 'needs_approval' ? '<button class="btn btn-sm" onclick="PF.T.review(\'' + t.id + '\')">' + App.ic('shield-check') + ' ' + T('بررسی و تأیید') + '</button>' : '') +
            (t.confirmation_ref ? '<button class="btn btn-sm btn-ghost" onclick="PF.T.run(\'' + t.id + '\',this)">▶ ' + T('اجرای فوری') + '</button>' : '') +
            '<button class="btn btn-sm btn-ghost" onclick="PF.T.runs(\'' + t.id + '\')">' + App.ic('scroll-text') + '</button>' +
            '<button class="btn btn-sm btn-ghost" onclick="PF.T.edit(\'' + t.id + '\')">' + App.ic('pencil') + '</button>' +
            '<button class="btn btn-sm btn-danger" onclick="PF.T.del(\'' + t.id + '\')">' + App.ic('trash-2') + '</button></div></div>';
        }).join('');
        if (location.hash) { var x = document.getElementById(location.hash.slice(1)); if (x) { x.classList.add('flash-hl'); x.scrollIntoView({ block: 'center' }); } }
      });
    },
    trgText: function (g) {
      g = g || {};
      if (g.type === 'interval') return T('هر') + ' ' + Math.round(g.expr / 60) + ' ' + T('دقیقه');
      if (g.type === 'once') return T('یک‌بار:') + ' ' + String(g.expr).replace('T', ' ');
      return 'cron ' + g.expr;
    },
    loadTools: function () {
      if (Tk.tools.length) return Promise.resolve(Tk.tools);
      return get('/pf/tools').then(function (r) {
        Tk.tools = (r.tools || []).filter(function (t) { return t.status === 'live' && ['schedule_task', 'job_status'].indexOf(t.tool_id) < 0; });
        var sel = $('taskTool'), groups = {};
        Tk.tools.forEach(function (t) { var g = t.source === 'builtin' ? T('ابزارهای داخلی') : T('اتصال‌های API من'); (groups[g] = groups[g] || []).push(t); });
        sel.innerHTML = Object.keys(groups).reverse().map(function (g) {
          return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (t) { return '<option value="' + esc(t.tool_id) + '">' + esc(t.name) + ' — ' + esc(t.tool_id) + '</option>'; }).join('') + '</optgroup>';
        }).join('');
        sel.onchange = function () { Tk.toolHint(true); };
        return Tk.tools;
      });
    },
    toolHint: function (fill) {
      var t = Tk.tools.filter(function (x) { return x.tool_id === $('taskTool').value; })[0]; if (!t) return;
      var p = t.parameters || {}, props = p.properties || {};
      $('taskToolHint').innerHTML = esc(t.description.slice(0, 300)) + '<br><span class="ltr mono">' + Object.keys(props).map(function (k) { return k + ((p.required || []).indexOf(k) >= 0 ? '*' : ''); }).join(', ') + '</span>' +
        (t.risk_level !== 'read' ? ' <span class="badge badge-warn">' + esc(t.risk_level) + '</span>' : '');
      if (fill) { var ex = {}; (p.required || []).forEach(function (k) { ex[k] = (props[k] || {}).type === 'array' ? [] : (props[k] || {}).type === 'object' ? {} : ''; }); document.querySelector('#taskForm [name=payload]').value = JSON.stringify(ex, null, 2); }
    },
    preset: function () {
      var v = $('trgPreset').value;
      document.querySelectorAll('#taskForm [data-trg]').forEach(function (d) { d.hidden = d.getAttribute('data-trg').split(' ').indexOf(v) < 0; });
    },
    trigger: function () {
      var v = $('trgPreset').value, tm = ($('trgTime').value || '08:00').split(':');
      if (v === 'daily') return { type: 'cron', expr: (+tm[1]) + ' ' + (+tm[0]) + ' * * *' };
      if (v === 'weekly') return { type: 'cron', expr: (+tm[1]) + ' ' + (+tm[0]) + ' * * ' + $('trgDow').value };
      if (v === 'hourly') return { type: 'cron', expr: '0 * * * *' };
      if (v === 'interval') return { type: 'interval', expr: String(Math.max(5, +$('trgEvery').value || 60) * 60) };
      if (v === 'once') return { type: 'once', expr: $('trgOnce').value };
      return { type: 'cron', expr: $('trgCron').value.trim() };
    },
    edit: function (id) {
      Tk.loadTools().then(function () {
        var f = $('taskForm'); f.reset(); f.id.value = id || ''; $('taskTitle').textContent = id ? T('ویرایش وظیفه') : T('وظیفهٔ جدید');
        $('trgPreset').value = 'daily'; Tk.preset();
        var t = id ? Tk.list.filter(function (x) { return x.id === id; })[0] : null;
        var qs = new URLSearchParams(location.search);
        if (t) {
          f.name.value = t.name; $('taskTool').value = t.tool_id; f.payload.value = JSON.stringify(t.payload || {}, null, 2);
          var g = t.trigger || {};
          if (g.type === 'interval') { $('trgPreset').value = 'interval'; $('trgEvery').value = Math.round(g.expr / 60); }
          else if (g.type === 'once') { $('trgPreset').value = 'once'; $('trgOnce').value = String(g.expr).slice(0, 16); }
          else { $('trgPreset').value = 'cron'; $('trgCron').value = g.expr; }
          Tk.preset();
          var pa = t.post_action || {};
          f.querySelectorAll('[name=ch]').forEach(function (c) { c.checked = (pa.channels || ['inapp']).indexOf(c.value) >= 0; });
          f.summarize.checked = !!pa.summarize; f.only_on.value = pa.only_on || 'always'; f.max_runs.value = t.max_runs || 0;
          Tk.toolHint(false);
        } else {
          if (qs.get('conn')) { var first = Tk.tools.filter(function (x) { return String(x.connection_id) === qs.get('conn') && x.risk_level === 'read'; })[0]; if (first) $('taskTool').value = first.tool_id; }
          if (qs.get('tool')) $('taskTool').value = qs.get('tool');
          Tk.toolHint(true);
        }
        open('taskModal');
      });
    },
    save: function (e) {
      e.preventDefault(); var f = $('taskForm'), payload;
      try { payload = JSON.parse(f.payload.value || '{}'); } catch (x) { App.toast(T('ورودی‌ها JSON معتبر نیست'), true); return false; }
      var chans = []; f.querySelectorAll('[name=ch]:checked').forEach(function (c) { chans.push(c.value); });
      var body = { name: f.name.value, tool_id: $('taskTool').value, payload: payload, trigger: Tk.trigger(), max_runs: +f.max_runs.value || 0,
        post_action: { type: 'notify', channels: chans.length ? chans : ['inapp'], summarize: f.summarize.checked, only_on: f.only_on.value } };
      post('/pf/tasks' + (f.id.value ? '/' + f.id.value : ''), body).then(function (r) {
        if (!r.ok) { App.toast(r.error, true); return; }
        close('taskModal'); Tk.load(); setTimeout(function () { Tk.review(r.task.id, r.task); }, 200);
      });
      return false;
    },
    review: function (id, t) {
      t = t || Tk.list.filter(function (x) { return x.id === id; })[0]; if (!t) return;
      $('approveBody').innerHTML = '<p class="hint">' + T('این وظیفه دقیقاً با ورودی‌ها و زمان‌بندی زیر، بدون حضور شما اجرا خواهد شد. هر ویرایش بعدی نیاز به تأیید دوباره دارد.') + '</p>' +
        '<table class="tbl"><tr><td>' + T('ابزار') + '</td><td><b>' + esc(t.tool.name) + '</b> <span class="ltr mono">' + esc(t.tool_id) + '@' + esc(t.tool_version) + '</span> ' +
        (t.tool.risk_level !== 'read' ? '<span class="badge badge-warn">' + esc(t.tool.risk_level) + '</span>' : '<span class="badge badge-green">read</span>') + '</td></tr>' +
        '<tr><td>' + T('زمان‌بندی') + '</td><td class="ltr">' + esc(Tk.trgText(t.trigger)) + ' (' + esc((t.trigger || {}).tz || 'Asia/Tehran') + ')</td></tr>' +
        '<tr><td>' + T('اجراهای بعدی') + '</td><td class="ltr">' + (t.upcoming || []).map(esc).join('<br>') + '</td></tr>' +
        '<tr><td>' + T('اعلان') + '</td><td>' + esc(((t.post_action || {}).channels || []).join(', ')) + '</td></tr></table>' +
        '<pre class="ltr">' + esc(JSON.stringify(t.payload || {}, null, 2)) + '</pre>';
      $('approveBtn').onclick = function () {
        post('/pf/tasks/' + id + '/approve').then(function (r) { if (!r.ok) { App.toast(r.error, true); return; } close('approveModal'); App.toast(T('وظیفه فعال شد')); Tk.load(); });
      };
      open('approveModal');
    },
    toggle: function (id, cb) {
      post('/pf/tasks/' + id + '/state', { state: cb.checked ? 'active' : 'paused' }).then(function (r) { if (!r.ok) { App.toast(r.error, true); cb.checked = !cb.checked; } Tk.load(); });
    },
    run: function (id, btn) {
      btn.disabled = true;
      post('/pf/tasks/' + id + '/run').then(function (r) {
        btn.disabled = false;
        if (!r.ok) { App.toast(r.error, true); return; }
        var res = r.result || {}; App.toast(res.queued ? T('در صف اجرا قرار گرفت') : (res.ok ? T('اجرا شد') : T('اجرا ناموفق بود')), res.ok === false);
        Tk.load();
      });
    },
    runs: function (id) {
      get('/pf/tasks/' + id + '/runs').then(function (r) {
        $('runsBody').innerHTML = (r.runs || []).length ? '<div class="tw"><table class="tbl"><thead><tr><th>' + T('زمان') + '</th><th>' + T('نوع') + '</th><th>' + T('وضعیت') + '</th><th>' + T('مدت') + '</th><th>' + T('هزینه') + '</th></tr></thead><tbody>' +
          r.runs.map(function (x) {
            return '<tr><td class="ltr">' + when(x.created_at) + '</td><td>' + (x.trigger === 'manual' ? T('دستی') : T('زمان‌بندی')) + '</td><td>' + badge(x.status) + '</td><td class="ltr">' + num(x.latency_ms) + 'ms</td><td>' + num(x.cost) + '</td></tr>' +
              '<tr><td colspan="5"><pre class="ltr" style="max-height:160px">' + esc(x.error || x.summary || '') + '</pre></td></tr>';
          }).join('') + '</tbody></table></div>' : '<p class="muted">' + T('هنوز اجرایی نداشته است.') + '</p>';
        open('runsModal');
      });
    },
    del: function (id) { if (confirm(T('این وظیفه حذف شود؟'))) post('/pf/tasks/' + id + '/delete').then(function () { Tk.load(); }); }
  };

  // ====================================================== agents
  var A = {
    mine: [], pub: [], skills: null, chosen: {},
    card: function (a, mine) {
      return '<div class="panel acard"><div class="ch"><span class="cic big">' + (a.icon ? esc(a.icon) : App.ic('bot')) + '</span><div style="min-width:0;flex:1"><b>' + esc(a.name) + '</b>' +
        '<div class="muted" style="font-size:.74rem">' + num((a.skills || []).length) + ' ' + T('مهارت') + ' · ' + num(a.uses) + ' ' + T('استفاده') + (a.visibility === 'public' ? ' · ' + App.ic('globe') : '') + '</div></div></div>' +
        '<p class="hint kd">' + esc((a.description || '').slice(0, 200)) + '</p><div class="cact"><a class="btn btn-sm" href="/?agent=' + a.id + '">' + App.ic('message-circle') + ' ' + T('گفتگو') + '</a>' +
        (mine ? '<button class="btn btn-sm btn-ghost" onclick="PF.A.edit(' + a.id + ')">' + App.ic('pencil') + '</button><button class="btn btn-sm btn-danger" onclick="PF.A.del(' + a.id + ')">' + App.ic('trash-2') + '</button>' : '') + '</div></div>';
    },
    load: function () {
      get('/pf/agents').then(function (r) {
        A.mine = r.mine || []; A.pub = r.public || [];
        $('agMine').innerHTML = A.mine.length ? A.mine.map(function (a) { return A.card(a, true); }).join('') : '<div class="panel muted">' + T('هنوز ایجنتی نساخته‌اید.') + '</div>';
        $('agPublic').innerHTML = A.pub.length ? A.pub.map(function (a) { return A.card(a, false); }).join('') : '<div class="panel muted">' + T('ایجنت عمومی‌ای وجود ندارد.') + '</div>';
      });
    },
    loadSkills: function () {
      if (A.skills) return Promise.resolve();
      return Promise.all([get('/pf/skills'), get('/pf/agent-models')]).then(function (rs) {
        A.skills = rs[0].groups || [];
        var sel = $('agModel'), groups = {};
        (rs[1].models || []).forEach(function (m) { (groups[m.provider || ''] = groups[m.provider || ''] || []).push(m); });
        Object.keys(groups).forEach(function (g) {
          var og = document.createElement('optgroup'); og.label = g || T('مدل‌ها');
          groups[g].forEach(function (m) { var o = document.createElement('option'); o.value = m.id; o.textContent = m.name || m.id; og.appendChild(o); });
          sel.appendChild(og);
        });
        $('skQ').oninput = A.renderSkills;
      });
    },
    renderSkills: function () {
      var q = ($('skQ').value || '').toLowerCase();
      $('agSkills').innerHTML = A.skills.map(function (g) {
        var list = g.items.filter(function (x) { return !q || (x.name + ' ' + (x.summary || '') + ' ' + x.skill).toLowerCase().indexOf(q) >= 0; });
        if (!list.length) return '';
        var all = list.every(function (x) { return A.chosen[x.skill]; });
        return '<div class="sksec"><span>' + esc(T(g.label)) + '</span><button type="button" class="skall" data-g="' + esc(g.key) + '">' +
          (all ? T('برداشتن همه') : T('انتخاب همه')) + '</button></div><div class="skgrid">' + list.map(function (x) {
          return '<label class="sk' + (A.chosen[x.skill] ? ' on' : '') + '"><input type="checkbox" value="' + esc(x.skill) + '" ' + (A.chosen[x.skill] ? 'checked' : '') +
            ' onchange="PF.A.pick(this)"><span class="ski">' + App.ic(x.icon || 'wrench', 'ic') + '</span><span><b>' + esc(x.name) + '</b>' +
            (x.status && x.status !== 'live' ? ' ' + badge(x.status) : '') + '<small>' + esc(x.summary || '') + '</small></span></label>';
        }).join('') + '</div>';
      }).join('') || '<div class="muted">' + T('مهارتی پیدا نشد.') + '</div>';
      $('agSkills').querySelectorAll('.skall').forEach(function (b) {
        b.onclick = function () {
          var g = A.skills.filter(function (x) { return x.key === b.getAttribute('data-g'); })[0]; if (!g) return;
          var all = g.items.every(function (x) { return A.chosen[x.skill]; });
          g.items.forEach(function (x) { if (all) delete A.chosen[x.skill]; else A.chosen[x.skill] = 1; });
          A.renderSkills();
        };
      });
    },
    pick: function (cb) { if (cb.checked) A.chosen[cb.value] = 1; else delete A.chosen[cb.value]; cb.closest('.sk').classList.toggle('on', cb.checked); },
    edit: function (id) {
      A.loadSkills().then(function () {
        var f = $('agForm'); f.reset(); f.id.value = id || ''; A.chosen = {}; $('agTitle').textContent = id ? T('ویرایش ایجنت') : T('ساخت ایجنت');
        if (id) {
          get('/pf/agents/' + id).then(function (r) {
            var a = r.agent; f.name.value = a.name; f.icon.value = a.icon; f.description.value = a.description || ''; f.model.value = a.model || '';
            f.instructions.value = a.instructions || ''; f.starters.value = (a.starters || []).join('\n'); f.visibility.checked = a.visibility === 'public';
            (a.skills || []).forEach(function (s) { A.chosen[s] = 1; }); A.renderSkills(); open('agModal');
          });
        } else { A.chosen = { 'builtin:image': 1, 'builtin:web_search': 1 }; A.renderSkills(); open('agModal'); }
      });
    },
    save: function (e) {
      e.preventDefault(); var f = $('agForm');
      var body = { name: f.name.value, icon: f.icon.value, description: f.description.value, model: f.model.value, instructions: f.instructions.value,
        starters: f.starters.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean), visibility: f.visibility.checked ? 'public' : 'private',
        skills: Object.keys(A.chosen) };
      post('/pf/agents' + (f.id.value ? '/' + f.id.value : ''), body).then(function (r) {
        if (!r.ok) { App.toast(r.error, true); return; } close('agModal'); A.load(); App.toast(T('ذخیره شد'));
      });
      return false;
    },
    del: function (id) { if (confirm(T('این ایجنت حذف شود؟'))) post('/pf/agents/' + id + '/delete').then(A.load); }
  };

  // ====================================================== jobs
  var J = {
    load: function () {
      get('/pf/jobs').then(function (r) {
        var rows = r.jobs || [];
        $('jobTbl').querySelector('tbody').innerHTML = rows.length ? rows.map(function (j) {
          return '<tr id="' + esc(j.id) + '"><td><b>' + esc(j.name || j.tool_id) + '</b><div class="ltr mono muted" style="font-size:.7rem">' + esc(j.tool_id) +
            (j.attempts > 1 ? ' · ' + T('تلاش') + ' ' + j.attempts : '') + '</div>' +
            (j.status === 'failed' && j.error ? '<div class="errbox" style="font-size:.74rem;margin-top:4px;padding:6px 10px">' + esc(String(j.error).slice(0, 240)) + '</div>' : '') + '</td>' +
            '<td>' + badge(j.status) + '</td><td>' + esc(j.channel) + '</td><td>' + num(j.cost) + '</td>' +
            '<td class="ltr">' + when(j.created_at) + '</td><td style="white-space:nowrap">' +
            (j.retryable ? '<button class="btn btn-sm" onclick="PF.J.retry(&quot;' + j.id + '&quot;,this)">' + App.ic('rotate-cw') + ' ' + T('تلاش مجدد') + '</button> ' : '') +
            '<button class="btn btn-sm btn-ghost" onclick="PF.J.show(&quot;' + j.id + '&quot;)">' + T('جزئیات') + '</button></td></tr>';
        }).join('') : '<tr><td colspan="6" class="muted">' + T('کاری در صف نیست.') + '</td></tr>';
        if (location.hash && !J.shown) { J.shown = 1; J.show(location.hash.slice(1)); }
        clearTimeout(J.t);
        if (rows.some(function (j) { return j.status === 'queued' || j.status === 'running'; })) J.t = setTimeout(J.load, 5000);
      });
    },
    retry: function (id, btn) {
      btn.disabled = true;
      post('/pf/jobs/' + id + '/retry').then(function (r) { App.toast(r.ok ? T('دوباره در صف قرار گرفت') : (r.error || T('خطا')), !r.ok); J.load(); });
    },
    show: function (id) {
      get('/pf/jobs/' + encodeURIComponent(id)).then(function (r) {
        if (!r.ok) return;
        var j = r.job, res = j.result || {};
        $('jobTitle').textContent = j.tool_id + ' — ' + id;
        $('jobBody').innerHTML = badge(j.status) + ' <span class="muted ltr">' + when(j.created_at) + ' → ' + when(j.finished_at) + '</span>' +
          ((res.files || []).map(function (f) {
            var m = f.mime || '';
            return '<div class="tfile">' + (/^video\//.test(m) ? '<video controls playsinline src="' + esc(f.url) + '"></video>' : /^image\//.test(m) ? '<img src="' + esc(f.url) + '" alt="">' : '') +
              '<a class="tdl" href="' + esc(f.url) + '" target="_blank">' + App.ic('download') + ' ' + esc(f.name) + '</a></div>';
          }).join('')) +
          (res.error ? '<div class="errbox">' + esc(res.error.message) + '</div>' : '') +
          (res.data ? '<pre class="ltr">' + esc(JSON.stringify(res.data, null, 2).slice(0, 20000)) + '</pre>' : '');
        open('jobModal');
      });
    }
  };

  // ====================================================== usage
  var U = {
    days: 30,
    load: function () {
      get('/pf/usage?days=' + U.days).then(function (r) {
        var cost = 0, calls = 0; (r.by_channel || []).forEach(function (c) { cost += +c.cost; calls += +c.calls; });
        $('uCost').textContent = num(cost) + ' ' + T('تومان'); $('uCalls').textContent = num(calls);
        $('uPlan').textContent = r.plan.name; $('uBal').textContent = num(r.balance) + ' ' + T('تومان');
        var max = Math.max.apply(null, (r.by_day || []).map(function (d) { return +d.cost; }).concat([1]));
        $('uDays').innerHTML = (r.by_day || []).map(function (d) {
          return '<div class="bar" title="' + esc(d.day) + ': ' + num(d.cost) + '"><i style="height:' + Math.max(2, Math.round(100 * d.cost / max)) + '%"></i><span>' + esc(String(d.day).slice(5)) + '</span></div>';
        }).join('') || '<span class="muted">' + T('بدون مصرف') + '</span>';
        $('uTools').querySelector('tbody').innerHTML = (r.by_tool || []).map(function (t) { return '<tr><td>' + esc(t.name) + '</td><td>' + num(t.calls) + ' ' + T('بار') + '</td><td><b>' + num(t.cost) + '</b></td></tr>'; }).join('') || '<tr><td class="muted">—</td></tr>';
        var CH = { chat: T('چت'), api: T('وب‌سرویس API'), schedule: T('وظایف زمان‌بندی‌شده'), agent: T('ایجنت‌ها') };
        $('uChan').querySelector('tbody').innerHTML = (r.by_channel || []).map(function (t) { return '<tr><td>' + esc(CH[t.channel] || t.channel) + '</td><td>' + num(t.calls) + '</td><td><b>' + num(t.cost) + '</b></td></tr>'; }).join('') || '<tr><td class="muted">—</td></tr>';
        $('uRecent').querySelector('tbody').innerHTML = (r.recent || []).map(function (t) {
          return '<tr><td class="ltr">' + when(t.created_at) + '</td><td>' + esc(t.name) + '</td><td>' + esc(CH[t.channel] || t.channel) + '</td><td>' + badge(t.status) + '</td><td class="ltr">' + num(t.latency_ms) + 'ms</td><td>' + num(t.cost) + '</td></tr>';
        }).join('');
        document.querySelector('#budgetForm [name=daily_limit]').value = (r.budget || {}).daily_limit || '';
      });
    },
    budget: function (e) {
      e.preventDefault();
      post('/pf/usage/budget', { daily_limit: document.querySelector('#budgetForm [name=daily_limit]').value || 0 }).then(function () { App.toast(T('ذخیره شد')); });
      return false;
    }
  };

  window.PF = { I: I, L: L, T: Tk, A: A, J: J, U: U, open: open, close: close };

  if (page === 'integrations') {
    seg('kindSeg', 'data-k', I.kind); seg('srcSeg', 'data-s', I.src);
    document.querySelector('#connForm [name=auth_type]').onchange = I.authUI; I.load();
  } else if (page === 'library') {
    seg('catSeg', 'data-c', function (c) { L.cat = c; L.load(); });
    var tm; $('libq').oninput = function () { clearTimeout(tm); tm = setTimeout(L.load, 300); }; L.load();
  } else if (page === 'tasks') {
    $('trgPreset').onchange = Tk.preset; Tk.load();
    var qs = new URLSearchParams(location.search); if (qs.get('conn') || qs.get('tool')) Tk.edit();
  } else if (page === 'agents') { A.load(); }
  else if (page === 'jobs') { J.load(); }
  else if (page === 'usage') { seg('daysSeg', 'data-d', function (d) { U.days = +d; U.load(); }); U.load(); }
})();
