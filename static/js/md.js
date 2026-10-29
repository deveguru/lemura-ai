/* Safe markdown rendering for AI replies: raw HTML is escaped, unsafe URLs dropped,
   code blocks get highlighting + a copy button, generated images get actions. */
(function () {
  var T = function (s) { return window.I18N ? I18N.t(s) : s; };
  var EXT = { python: 'py', py: 'py', javascript: 'js', js: 'js', typescript: 'ts', ts: 'ts', jsx: 'jsx', tsx: 'tsx',
    html: 'html', xml: 'xml', css: 'css', scss: 'scss', json: 'json', yaml: 'yml', yml: 'yml', bash: 'sh', sh: 'sh',
    shell: 'sh', zsh: 'sh', powershell: 'ps1', ps1: 'ps1', php: 'php', java: 'java', kotlin: 'kt', swift: 'swift',
    go: 'go', golang: 'go', rust: 'rs', c: 'c', cpp: 'cpp', 'c++': 'cpp', csharp: 'cs', cs: 'cs', ruby: 'rb', rb: 'rb',
    sql: 'sql', dart: 'dart', lua: 'lua', r: 'r', markdown: 'md', md: 'md', dockerfile: 'Dockerfile', ini: 'ini',
    toml: 'toml', vue: 'vue', svelte: 'svelte', nginx: 'conf', apache: 'conf', perl: 'pl', scala: 'scala', text: 'txt' };
  function download(code, lang) {
    var ext = EXT[(lang || '').toLowerCase()] || 'txt';
    var name = ext === 'Dockerfile' ? 'Dockerfile' : 'lemura-code.' + ext;
    var url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function esc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
  function safeUrl(u) {
    u = String(u || '').trim();
    return /^(https?:\/\/|\/(?!\/)|#|mailto:)/i.test(u) ? u : '';
  }
  if (window.marked) {
    marked.use({
      gfm: true, breaks: true,
      renderer: {
        html: function (t) { return esc(t.text || t.raw || ''); },
        link: function (t) {
          var href = safeUrl(t.href); var text = this.parser.parseInline(t.tokens);
          return href ? '<a href="' + esc(href) + '" target="_blank" rel="noopener nofollow">' + text + '</a>' : text;
        },
        image: function (t) {
          var src = safeUrl(t.href); if (!src) return esc(t.text || '');
          if (/\.(mp4|webm|mov)$/i.test(t.text || '') || /\.(mp4|webm)(\?|$)/i.test(src)) {
            return '<span class="genvid"><video controls playsinline preload="metadata" src="' + esc(src) + '"></video>' +
              '<span class="acts"><a href="' + esc(src) + '" download>' + App.ic('download') + ' ' + T('دانلود') + '</a></span></span>';
          }
          return '<span class="genimg"><img src="' + esc(src) + '" alt="' + esc(t.text || '') + '" loading="lazy" data-zoom>' +
            '<span class="acts"><a href="' + esc(src) + '" download>' + App.ic('download') + ' ' + T('دانلود') + '</a><a href="' + esc(src) + '" target="_blank" rel="noopener">' + App.ic('arrow-up-right') + ' ' + T('باز کردن') + '</a>' +
            (src.indexOf('/uploads/') === 0 ? '<button type="button" data-drive="' + esc(src) + '">' + App.ic('cloud') + ' ' + T('درایو') + '</button>' : '') + '</span></span>';
        },
        code: function (t) {
          var lang = (t.lang || '').split(/\s/)[0], body;
          try {
            body = window.hljs && lang && hljs.getLanguage(lang) ? hljs.highlight(t.text, { language: lang }).value
              : window.hljs ? hljs.highlightAuto(t.text).value : esc(t.text);
          } catch (e) { body = esc(t.text); }
          return '<pre data-lang="' + esc(lang) + '"><span class="lang">' + esc(lang) + '</span><span class="cbar">' +
            '<button class="cp" type="button" data-copy>' + T('کپی') + '</button><button class="cp" type="button" data-dl>' + T('دانلود') + '</button></span>' +
            '<code class="hljs">' + body + '</code></pre>';
        }
      }
    });
  }
  function render(text) {
    text = String(text || '').replace(/<!--sources:[\s\S]*?-->/g, '');
    if (!window.marked) return '<p>' + esc(text).replace(/\n/g, '<br>') + '</p>';
    try { return marked.parse(text); } catch (e) { return '<p>' + esc(text) + '</p>'; }
  }
  function sources(text) {
    var m = /<!--sources:([\s\S]*?)-->/.exec(String(text || ''));
    if (!m) return [];
    try { return JSON.parse(m[1]) || []; } catch (e) { return []; }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-copy],[data-dl]');
    if (b) {
      var pre = b.closest('pre'), code = pre.querySelector('code').innerText;
      if (b.hasAttribute('data-dl')) { download(code, pre.getAttribute('data-lang')); return; }
      var orig = b.textContent;
      navigator.clipboard.writeText(code).then(function () { b.innerHTML = App.ic('check'); setTimeout(function () { b.textContent = orig; }, 1500); });
      return;
    }
    var dv = e.target.closest && e.target.closest('[data-drive]');
    if (dv && window.App) { App.toDrive({ url: dv.getAttribute('data-drive') }); return; }
    var img = e.target.closest && e.target.closest('img[data-zoom]');
    if (img && window.App) App.lightbox(img.src);
  });
  window.MD = { render: render, sources: sources, esc: esc, safeUrl: safeUrl };
})();
