/* Voice input (dictation): tap the mic, speak, and the speech is transcribed (/chat/stt) and sent to the assistant
   right away; the assistant answers in text (no spoken reply). Recording stops by itself after a short silence or
   when the mic is tapped again. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };
  var V = { rec: null, stream: null, ctx: null, an: null, chunks: [], started: 0, heard: false, lastVoice: 0, raf: 0, busy: false, send: false };
  var START_RMS = 0.04, SILENCE_MS = 1600, MAX_MS = 90000, MIN_MS = 500;

  function btn(state) {
    var b = $('micBtn'); if (!b) return;
    b.classList.toggle('rec', state === 'rec');
    b.classList.toggle('wait', state === 'wait');
    b.title = state === 'rec' ? T('در حال ضبط — برای ارسال دوباره بزنید') : state === 'wait' ? T('در حال تبدیل صدا به متن...') :
      T('ورودی صوتی: صحبت کنید تا به متن تبدیل و ارسال شود');
    if (state !== 'rec') $('micTime').textContent = '';
  }
  function rms() {
    var buf = new Float32Array(V.an.fftSize); V.an.getFloatTimeDomainData(buf);
    var s = 0; for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }
  function loop() {
    if (!V.rec) return;
    var now = Date.now(), level = rms();
    if (level > START_RMS) { V.heard = true; V.lastVoice = now; }
    var secs = Math.floor((now - V.started) / 1000);
    $('micTime').textContent = Math.floor(secs / 60) + ':' + ('0' + secs % 60).slice(-2);
    $('micBtn').style.setProperty('--lvl', Math.min(level * 8, 1).toFixed(2));
    if ((V.heard && now - V.lastVoice > SILENCE_MS && now - V.started > MIN_MS) || now - V.started > MAX_MS) { stop(true); return; }
    V.raf = requestAnimationFrame(loop);
  }
  function cleanup() {
    cancelAnimationFrame(V.raf);
    if (V.stream) V.stream.getTracks().forEach(function (t) { t.stop(); });
    if (V.ctx) V.ctx.close().catch(function () {});
    V.stream = V.ctx = V.an = null;
  }
  function start() {
    if (!window.LEMURA || !LEMURA.user) { if (window.Auth) Auth.open(T('برای ورودی صوتی وارد شوید')); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { App.toast(T('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند'), true); return; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
      V.stream = stream; V.chunks = []; V.heard = false; V.started = V.lastVoice = Date.now();
      var AC = window.AudioContext || window.webkitAudioContext;
      V.ctx = new AC(); V.an = V.ctx.createAnalyser(); V.an.fftSize = 1024; V.ctx.createMediaStreamSource(stream).connect(V.an);
      var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
      V.rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      var rec = V.rec;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) V.chunks.push(e.data); };
      rec.onstop = function () { upload(rec.mimeType || mime || 'audio/webm'); };
      rec.start(250); btn('rec'); loop();
    }).catch(function () { App.toast(T('اجازهٔ دسترسی به میکروفون داده نشد'), true); });
  }
  function stop(send) {
    if (!V.rec) return;
    V.send = !!send;
    var rec = V.rec; V.rec = null;
    try { rec.stop(); } catch (e) { upload(''); }
    cleanup();
  }
  function upload(mime) {
    if (!V.send || !V.heard || !V.chunks.length) { btn('idle'); if (V.send && !V.heard) App.toast(T('صدایی شنیده نشد'), true); return; }
    var blob = new Blob(V.chunks, { type: mime || 'audio/webm' }), ext = /mp4/.test(mime) ? 'm4a' : 'webm';
    var fd = new FormData(); fd.append('audio', blob, 'voice.' + ext); fd.append('lang', (window.I18N && I18N.lang) || 'fa');
    btn('wait'); V.busy = true;
    fetch('/chat/stt', { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) {
      V.busy = false; btn('idle');
      if (!r.ok) { App.toast(r.error || T('تبدیل صدا به متن ناموفق بود'), true); return; }
      if (r.balance != null) App.setBalance(r.balance);
      var text = (r.text || '').trim();
      if (!text) { App.toast(T('صدایی شنیده نشد'), true); return; }
      if (window.Chat) Chat.sendText(text, { voice: true });
    }).catch(function () { V.busy = false; btn('idle'); App.toast(T('ارتباط با سرور برقرار نشد'), true); });
  }
  window.Voice = {
    toggle: function () { if (V.busy) return; if (V.rec) stop(true); else start(); },
    cancel: function () { stop(false); }
  };
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && V.rec) stop(false); });
})();
