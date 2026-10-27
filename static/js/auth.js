/* Unified login / register box: identifier -> password or SMS code. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var M = $('authModal'); if (!M) return;
  var phone = '', isNew = false, timer = null, busy = false;
  var LEN = parseInt($('aOtpRow').getAttribute('data-len'), 10) || 6;

  function fa2en(s) { return String(s || '').replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }); }
  function msg(t, ok) { var m = $('aMsg'); m.textContent = t || ''; m.className = 'amsg' + (t ? (ok ? ' ok' : ' err') : ''); }
  function post(url, data) {
    var fd = new FormData(); for (var k in data) fd.append(k, data[k]);
    return fetch(url, { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); });
  }
  function step(name) {
    ['aStep1', 'aPass', 'aOtp'].forEach(function (s) { $(s).style.display = s === name ? 'block' : 'none'; });
    var f = { aStep1: 'aId', aPass: 'aPw' }[name];
    setTimeout(function () { if (f) $(f).focus(); else { var i = $('aOtpRow').querySelector('input'); if (i) i.focus(); } }, 60);
  }
  function load(btn, on) { busy = on; btn.disabled = on; if (on) { btn.dataset.t = btn.textContent; btn.textContent = '...'; } else if (btn.dataset.t) btn.textContent = btn.dataset.t; }
  function done(r) {
    msg(r.data.message || 'ورود موفق', true);
    var next = new URLSearchParams(location.search).get('next');
    setTimeout(function () { location.href = next && next.charAt(0) === '/' && next.charAt(1) !== '/' ? next : location.pathname; }, 400);
  }

  function buildOtp() {
    var row = $('aOtpRow'); row.innerHTML = '';
    for (var i = 0; i < LEN; i++) {
      var inp = document.createElement('input'); inp.className = 'input'; inp.maxLength = 1; inp.inputMode = 'numeric';
      inp.autocomplete = i === 0 ? 'one-time-code' : 'off'; row.appendChild(inp);
    }
    var ins = row.querySelectorAll('input');
    ins.forEach(function (inp, i) {
      inp.addEventListener('input', function () {
        var v = fa2en(inp.value).replace(/\D/g, '');
        if (v.length > 1) { v.split('').slice(0, LEN - i).forEach(function (ch, j) { ins[i + j].value = ch; }); }
        else inp.value = v;
        var nx = Math.min(LEN - 1, i + Math.max(1, v.length)); if (v) ins[nx].focus();
        if (code().length === LEN && !isNew) verify();
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !inp.value && i > 0) ins[i - 1].focus();
        if (e.key === 'Enter') verify();
      });
    });
  }
  function code() { return Array.prototype.map.call($('aOtpRow').querySelectorAll('input'), function (i) { return i.value; }).join(''); }

  function startTimer(sec) {
    clearInterval(timer); $('aResend').disabled = true;
    timer = setInterval(function () {
      sec--; $('aTimer').textContent = sec > 0 ? Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2) : '';
      if (sec <= 0) { clearInterval(timer); $('aResend').disabled = false; }
    }, 1000);
  }

  function sendOtp(attempt) {
    attempt = attempt || 1; msg('');
    var b = $('aNext'); load(b, true);
    return post('/auth/send-otp', { phone: phone, attempt: attempt }).then(function (r) {
      load(b, false);
      if (!r.success) { if (r.data.retry) return sendOtp(attempt + 1); msg(r.data.message); return; }
      isNew = !!r.data.is_new;
      $('aPhoneShow').textContent = phone;
      $('aNames').style.display = isNew ? 'block' : 'none';
      $('aGift').style.display = isNew ? 'block' : 'none';
      $('aTitle').textContent = isNew ? 'ساخت حساب جدید' : 'تأیید شماره';
      buildOtp(); step('aOtp'); startTimer(r.data.expire || 120);
    }).catch(function () { load(b, false); msg('خطای ارتباط با سرور'); });
  }

  function verify() {
    if (busy) return;
    var c = code(); if (c.length !== LEN) { msg('کد تأیید را کامل وارد کنید'); return; }
    var name = ($('aName').value || '').trim().split(/\s+/);
    var b = $('aVerify'); load(b, true);
    post('/auth/verify-otp', { phone: phone, otp: c, fname: name[0] || '', lname: name.slice(1).join(' ') }).then(function (r) {
      load(b, false);
      if (r.success) return done(r);
      if (r.data.need_names) { $('aNames').style.display = 'block'; $('aName').focus(); }
      msg(r.data.message);
    }).catch(function () { load(b, false); msg('خطای ارتباط با سرور'); });
  }

  $('aNext').onclick = function () {
    var id = fa2en($('aId').value).trim(); if (!id) { msg('شماره موبایل یا ایمیل را وارد کنید'); return; }
    if (/^9\d{9}$/.test(id)) id = '0' + id;
    if (/^\+?989\d{9}$/.test(id)) id = '0' + id.replace(/^\+?98/, '');
    msg(''); var b = this; load(b, true);
    post('/auth/identify', { identifier: id }).then(function (r) {
      load(b, false);
      if (!r.success) { msg(r.data.message); return; }
      phone = r.data.is_mobile ? id : '';
      if (r.data.has_password) {
        $('aTitle').textContent = 'خوش برگشتید' + (r.data.name ? '، ' + r.data.name : '');
        $('aUseOtp').style.display = r.data.is_mobile ? '' : 'none';
        step('aPass');
      } else sendOtp();
    }).catch(function () { load(b, false); msg('خطای ارتباط با سرور'); });
  };
  $('aId').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('aNext').click(); });
  $('aPassBtn').onclick = function () {
    var b = this; load(b, true); msg('');
    post('/auth/password-login', { username: fa2en($('aId').value).trim(), password: $('aPw').value }).then(function (r) {
      load(b, false); if (r.success) done(r); else msg(r.data.message);
    }).catch(function () { load(b, false); msg('خطای ارتباط با سرور'); });
  };
  $('aPw').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('aPassBtn').click(); });
  $('aUseOtp').onclick = function () { sendOtp(); };
  $('aVerify').onclick = verify;
  $('aResend').onclick = function () { sendOtp(); };
  M.querySelectorAll('[data-back]').forEach(function (b) {
    b.onclick = function () { clearInterval(timer); msg(''); $('aTitle').textContent = 'ورود یا ثبت‌نام'; step('aStep1'); };
  });
  M.addEventListener('click', function (e) { if (e.target === M) Auth.close(); });

  var ERR = { google_off: 'ورود با گوگل فعال نیست', google_state: 'نشست ورود منقضی شد؛ دوباره تلاش کنید',
    google_cancel: 'ورود با گوگل لغو شد', google_net: 'ارتباط با گوگل برقرار نشد', google_email: 'ایمیل گوگل تأیید نشده است',
    blocked: 'حساب کاربری شما مسدود شده است' };
  window.Auth = {
    open: function (why) { M.classList.add('open'); if (why) msg(why); step('aStep1'); },
    close: function () { M.classList.remove('open'); }
  };
  var qs = new URLSearchParams(location.search);
  if (qs.get('login')) { Auth.open(ERR[qs.get('err')] || ''); }
})();
