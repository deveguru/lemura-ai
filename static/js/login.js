(function () {
  var modal = document.getElementById('loginModal');
  if (!modal) return;
  var msg = document.getElementById('lMsg');
  var otpLen = 6, phone = '', ticker = null;
  function post(url, data) {
    var fd = new FormData();
    for (var k in data) fd.append(k, data[k]);
    return fetch(url, { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); });
  }
  function setMsg(t, cls) { msg.textContent = t; msg.className = 'lmsg ' + cls; }
  function clrMsg() { msg.className = 'lmsg'; msg.textContent = ''; }
  document.getElementById('loginClose').onclick = function () { modal.classList.remove('open'); };
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.classList.remove('open'); });

  var tabs = modal.querySelectorAll('.ltab');
  tabs.forEach(function (b) {
    b.onclick = function () {
      tabs.forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active'); clrMsg();
      modal.querySelectorAll('[data-panel]').forEach(function (p) {
        p.style.display = p.getAttribute('data-panel') === b.dataset.ltab ? '' : 'none';
      });
    };
  });

  // build OTP cells
  var row = document.getElementById('otpRow');
  for (var i = 0; i < otpLen; i++) {
    var c = document.createElement('input');
    c.className = 'otp-cell'; c.maxLength = 1; c.inputMode = 'numeric';
    row.appendChild(c);
  }
  var cells = row.querySelectorAll('.otp-cell');
  function otp() { return Array.prototype.map.call(cells, function (c) { return c.value; }).join(''); }
  cells.forEach(function (ce, i) {
    ce.addEventListener('input', function () {
      this.value = this.value.replace(/\D/g, '').slice(-1);
      if (this.value && i < cells.length - 1) cells[i + 1].focus();
      if (otp().length === otpLen) setTimeout(doVerify, 120);
    });
    ce.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !this.value && i > 0) cells[i - 1].focus();
    });
  });

  var s1 = document.getElementById('otpStep1'), s2 = document.getElementById('otpStep2');
  var namesDiv = document.getElementById('otpNames'), timerEl = document.getElementById('otpTimer');
  function countdown(sec) {
    clearInterval(ticker); var r = sec;
    function tick() { timerEl.textContent = 'ارسال مجدد: ' + Math.floor(r / 60) + ':' + (r % 60 < 10 ? '0' : '') + (r % 60); }
    tick();
    ticker = setInterval(function () { r--; if (r <= 0) { clearInterval(ticker); timerEl.innerHTML = '<a href="#" id="otpResend">ارسال مجدد</a>'; var rr = document.getElementById('otpResend'); if (rr) rr.onclick = function (e) { e.preventDefault(); s2.style.display = 'none'; s1.style.display = ''; doSend(); }; } else tick(); }, 1000);
  }
  function doSend(attempt) {
    attempt = attempt || 1;
    post('/auth/send-otp', { phone: phone, attempt: attempt }).then(function (r) {
      if (r.success) { s1.style.display = 'none'; s2.style.display = ''; if (r.data.is_new) namesDiv.style.display = 'flex'; setMsg('کد ارسال شد', 'ok'); countdown(r.data.expire || 120); cells[0].focus(); }
      else if (r.data && r.data.retry && attempt < 3) setTimeout(function () { doSend(attempt + 1); }, 2000);
      else { setMsg(r.data ? r.data.message : 'خطا', 'err'); sendBtn.disabled = false; sendBtn.textContent = 'دریافت کد تأیید'; }
    });
  }
  var sendBtn = document.getElementById('otpSend');
  sendBtn.onclick = function () {
    phone = document.getElementById('otpPhone').value.trim();
    if (!/^09\d{9}$/.test(phone)) { setMsg('شماره صحیح نیست', 'err'); return; }
    clrMsg(); sendBtn.disabled = true; sendBtn.textContent = 'در حال ارسال...'; doSend(1);
  };
  function doVerify() {
    var c = otp(); if (c.length < otpLen) { setMsg('کد کامل نیست', 'err'); return; }
    clrMsg();
    post('/auth/verify-otp', { phone: phone, otp: c, fname: document.getElementById('otpFn').value.trim(), lname: document.getElementById('otpLn').value.trim() }).then(function (r) {
      if (r.success) { setMsg('ورود موفق!', 'ok'); setTimeout(function () { location.href = r.data.redirect || '/panel'; }, 600); }
      else setMsg(r.data ? r.data.message : 'خطا', 'err');
    });
  }
  document.getElementById('otpVerify').onclick = doVerify;
  document.getElementById('otpBack').onclick = function () { clearInterval(ticker); s2.style.display = 'none'; s1.style.display = ''; sendBtn.disabled = false; sendBtn.textContent = 'دریافت کد تأیید'; cells.forEach(function (c) { c.value = ''; }); clrMsg(); };

  document.getElementById('passBtn').onclick = function () {
    var u = document.getElementById('passUser').value.trim(), p = document.getElementById('passPw').value;
    if (!u || !p) { setMsg('شماره و رمز الزامی است', 'err'); return; }
    clrMsg();
    post('/auth/password-login', { username: u, password: p }).then(function (r) {
      if (r.success) { setMsg('ورود موفق!', 'ok'); setTimeout(function () { location.href = r.data.redirect || '/panel'; }, 500); }
      else setMsg(r.data ? r.data.message : 'خطا', 'err');
    });
  };
  document.getElementById('regBtn').onclick = function () {
    var m = document.getElementById('regMobile').value.trim(), n = document.getElementById('regName').value.trim(), p = document.getElementById('regPw').value;
    if (!m || !n || !p) { setMsg('تمام فیلدها الزامی است', 'err'); return; }
    clrMsg();
    post('/auth/register', { mobile: m, display_name: n, password: p }).then(function (r) {
      if (r.success) { setMsg('ثبت‌نام موفق!', 'ok'); setTimeout(function () { location.href = r.data.redirect || '/panel'; }, 600); }
      else setMsg(r.data ? r.data.message : 'خطا', 'err');
    });
  };
})();
