/* Live voice conversation: listen (voice-activity detection) -> /chat/stt -> chat reply -> /chat/tts -> play -> listen.
   Speaking while the assistant talks interrupts it (barge-in). */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };
  var V = { on: false, stream: null, ctx: null, an: null, rec: null, chunks: [], speaking: false, lastVoice: 0,
    started: 0, state: 'idle', audio: null, raf: 0 };
  var START_RMS = 0.045, SILENCE_MS = 1300, MIN_MS = 450, MAX_MS = 60000;

  function setState(st, text) {
    V.state = st;
    var ov = $('voiceOv'); if (!ov) return;
    ov.setAttribute('data-state', st);
    $('voiceStatus').textContent = text || { listening: T('در حال گوش دادن...'), hearing: T('می‌شنوم...'),
      thinking: T('در حال فکر کردن...'), speaking: T('در حال صحبت...'), idle: '' }[st] || '';
  }
  function rms() {
    var buf = new Float32Array(V.an.fftSize); V.an.getFloatTimeDomainData(buf);
    var s = 0; for (var i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }
  function loop() {
    if (!V.on) return;
    var level = rms(), now = Date.now();
    var orb = $('voiceOrb'); if (orb) orb.style.transform = 'scale(' + (1 + Math.min(level * 6, 0.6)) + ')';
    var threshold = V.state === 'speaking' ? START_RMS * 2.2 : START_RMS;
    if (level > threshold) {
      V.lastVoice = now;
      if (V.state === 'speaking') { stopAudio(); }           // barge-in
      if (V.state === 'listening' || V.state === 'speaking') startRec();
    }
    if (V.state === 'hearing') {
      if ((now - V.lastVoice > SILENCE_MS && now - V.started > MIN_MS) || now - V.started > MAX_MS) stopRec();
    }
    V.raf = requestAnimationFrame(loop);
  }
  function startRec() {
    V.chunks = []; V.started = Date.now();
    var mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
    V.rec = new MediaRecorder(V.stream, mime ? { mimeType: mime } : undefined);
    V.rec.ondataavailable = function (e) { if (e.data.size) V.chunks.push(e.data); };
    V.rec.onstop = onRecorded;
    V.rec.start(); setState('hearing');
  }
  function stopRec() { if (V.rec && V.rec.state === 'recording') { setState('thinking'); V.rec.stop(); } }
  function onRecorded() {
    if (!V.on) return;
    var blob = new Blob(V.chunks, { type: (V.rec && V.rec.mimeType) || 'audio/webm' });
    if (blob.size < 2500) { setState('listening'); return; }
    var fd = new FormData(); fd.append('audio', blob, 'voice.webm'); fd.append('lang', (window.I18N && I18N.lang) || 'fa');
    fetch('/chat/stt', { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (r) {
      if (!V.on) return;
      if (!r.ok) { App.toast(r.error || T('خطا'), true); setState('listening'); return; }
      if (r.balance != null) App.setBalance(r.balance);
      var text = (r.text || '').trim();
      if (!text) { setState('listening'); return; }
      $('voiceHeard').textContent = text;
      setState('thinking'); Chat.sendText(text, { voice: true });
    }).catch(function () { setState('listening'); });
  }
  function stopAudio() { if (V.audio) { V.audio.pause(); V.audio = null; } }
  function speak(text) {
    if (!text) { setState('listening'); return; }
    setState('speaking');
    fetch('/chat/tts', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text }) }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error(j.error || 'tts'); });
      return r.blob();
    }).then(function (b) {
      if (!V.on || V.state !== 'speaking') return;
      var url = URL.createObjectURL(b); V.audio = new Audio(url);
      V.audio.onended = function () { URL.revokeObjectURL(url); V.audio = null; if (V.on && V.state === 'speaking') setState('listening'); };
      V.audio.play().catch(function () { setState('listening'); });
    }).catch(function (e) { App.toast(e.message || T('خطا'), true); if (V.on) setState('listening'); });
  }
  function open() {
    if (!LEMURA.user) { Auth.open(T('برای گفتگوی صوتی وارد شوید')); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { App.toast(T('مرورگر شما از ضبط صدا پشتیبانی نمی‌کند'), true); return; }
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }).then(function (stream) {
      V.stream = stream; V.on = true;
      V.ctx = new (window.AudioContext || window.webkitAudioContext)();
      V.an = V.ctx.createAnalyser(); V.an.fftSize = 1024;
      V.ctx.createMediaStreamSource(stream).connect(V.an);
      $('voiceOv').classList.add('open'); $('voiceHeard').textContent = '';
      setState('listening'); loop();
    }).catch(function () { App.toast(T('دسترسی به میکروفون داده نشد'), true); });
  }
  function close() {
    V.on = false; cancelAnimationFrame(V.raf); stopAudio();
    if (V.rec && V.rec.state === 'recording') { V.rec.onstop = null; V.rec.stop(); }
    if (V.stream) V.stream.getTracks().forEach(function (t) { t.stop(); });
    if (V.ctx) V.ctx.close();
    V.stream = V.ctx = V.an = V.rec = null; setState('idle');
    $('voiceOv').classList.remove('open');
  }
  // chat tells us when a reply finished; speak it only for turns started by voice
  var prev = Chat.onReply;
  Chat.onReply = function (full, err) {
    if (prev) prev(full, err);
    if (!V.on) return;
    if (err) { setState('listening'); return; }
    speak(full);
  };
  window.Voice = { open: open, close: close, tapToTalk: function () { if (V.state === 'hearing') stopRec(); else if (V.state === 'speaking') { stopAudio(); setState('listening'); } } };
})();
