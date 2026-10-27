/* Safe markdown rendering for AI replies: raw HTML is escaped, unsafe URLs dropped,
   code blocks get highlighting + a copy button, generated images get actions. */
(function () {
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
          return '<span class="genimg"><img src="' + esc(src) + '" alt="' + esc(t.text || '') + '" loading="lazy" data-zoom>' +
            '<span class="acts"><a href="' + esc(src) + '" download>⬇ دانلود</a><a href="' + esc(src) + '" target="_blank" rel="noopener">↗ باز کردن</a></span></span>';
        },
        code: function (t) {
          var lang = (t.lang || '').split(/\s/)[0], body;
          try {
            body = window.hljs && lang && hljs.getLanguage(lang) ? hljs.highlight(t.text, { language: lang }).value
              : window.hljs ? hljs.highlightAuto(t.text).value : esc(t.text);
          } catch (e) { body = esc(t.text); }
          return '<pre><span class="lang">' + esc(lang) + '</span><button class="cp" type="button" data-copy>کپی</button><code class="hljs">' + body + '</code></pre>';
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
    var b = e.target.closest && e.target.closest('[data-copy]');
    if (b) {
      var code = b.parentNode.querySelector('code').innerText;
      navigator.clipboard.writeText(code).then(function () { b.textContent = '✓ کپی شد'; setTimeout(function () { b.textContent = 'کپی'; }, 1500); });
      return;
    }
    var img = e.target.closest && e.target.closest('img[data-zoom]');
    if (img && window.App) App.lightbox(img.src);
  });
  window.MD = { render: render, sources: sources, esc: esc, safeUrl: safeUrl };
})();
