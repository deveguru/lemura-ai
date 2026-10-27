(function () {
  var go = document.getElementById('aivGo'), status = document.getElementById('aivStatus');
  var result = document.getElementById('aivResult'), hist = document.getElementById('aivHistory');
  if (!go) return;
  function post(url, data) {
    var fd = new FormData(); for (var k in data) fd.append(k, data[k]);
    return fetch(url, { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (r) { return r.json(); });
  }
  function loadHistory() {
    post('/vision/history', {}).then(function (r) {
      if (!r.success) return;
      hist.innerHTML = (r.data || []).map(function (h) {
        if (h.status === 'done' && h.image_url) return '<div style="position:relative"><img src="' + h.image_url + '" style="width:100%;border-radius:10px;border:1px solid var(--bd-soft)"><button data-del="' + h.id + '" style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,.6);border:none;color:#fff;border-radius:6px;cursor:pointer;padding:3px 7px">✕</button></div>';
        if (h.status === 'pending' || h.status === 'processing') return '<div style="aspect-ratio:1;border:1px dashed var(--bd);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--t3);font-size:.75rem">در صف...</div>';
        return '<div style="aspect-ratio:1;border:1px solid var(--red);border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--red);font-size:.72rem">ناموفق</div>';
      }).join('');
      hist.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { post('/vision/delete', { id: b.dataset.del }).then(loadHistory); }; });
    });
  }
  go.onclick = function () {
    var model = document.getElementById('aivModel').value, size = document.getElementById('aivSize').value, prompt = document.getElementById('aivPrompt').value.trim();
    if (!prompt) { lemuraToast('پرامپت را بنویسید', true); return; }
    go.disabled = true; status.textContent = 'در حال تولید... (ممکن است تا یک دقیقه طول بکشد)'; result.innerHTML = '';
    post('/vision/submit', { model: model, size: size, prompt: prompt }).then(function (r) {
      if (!r.success) { go.disabled = false; status.textContent = ''; lemuraToast(r.data && r.data.msg ? r.data.msg : 'خطا', true); return; }
      if (r.data.status === 'done') { showResult(r.data.url); done(r.data.new_balance); }
      else { status.textContent = 'در صف پردازش...'; pollJob(r.data.job_id); }
    }).catch(function () { go.disabled = false; status.textContent = ''; lemuraToast('خطای شبکه', true); });
  };
  function pollJob(jid) {
    var n = 0;
    var iv = setInterval(function () {
      n++;
      post('/vision/poll', { job_id: jid }).then(function (r) {
        if (!r.success) return;
        if (r.data.status === 'done') { clearInterval(iv); showResult(r.data.url); done(r.data.new_balance); }
        else if (r.data.status === 'failed') { clearInterval(iv); go.disabled = false; status.textContent = ''; lemuraToast(r.data.error || 'ناموفق', true); loadHistory(); }
        else if (n > 60) { clearInterval(iv); go.disabled = false; status.textContent = 'هنوز در صف است؛ بعداً در تاریخچه بررسی کنید.'; loadHistory(); }
      });
    }, 4000);
  }
  function showResult(url) { result.innerHTML = '<div class="card" style="margin-bottom:16px;text-align:center"><img src="' + url + '" style="max-width:100%;border-radius:12px"><div style="margin-top:8px"><a class="btn btn-sm" href="' + url + '" download target="_blank">دانلود</a></div></div>'; }
  function done(bal) { go.disabled = false; status.textContent = 'انجام شد ✓'; var b = document.getElementById('balNum'); if (b && typeof bal !== 'undefined') b.textContent = commaNum(bal); loadHistory(); }
  loadHistory();
})();
