/* Page wiring: highlight wall, film tabs + chapter player, synced comparisons, deep links. */
(function () {
  'use strict';
  const DATA = window.EVOREEL, esc = window.escHtml, fmtTime = window.fmtTime;
  const byId = Object.fromEntries(DATA.films.map(f => [f.id, f]));
  const player = new window.ChapterPlayer();

  /* ---------- film selection ---------- */
  function selectFilm(id, t, autoplay) {
    const film = byId[id] || DATA.films[0];
    document.querySelectorAll('.film-tab').forEach(b => b.classList.toggle('is-active', b.dataset.id === film.id));
    player.load(film, t, autoplay);
  }

  const tabs = document.getElementById('film-tabs');
  DATA.films.forEach(f => {
    const b = document.createElement('button');
    b.className = 'film-tab';
    b.dataset.id = f.id;
    b.setAttribute('role', 'tab');
    b.innerHTML = '<img loading="lazy" src="' + f.poster + '" alt="">' +
      '<div class="ft-text"><div class="ft-title">' + esc(f.title) + '</div>' +
      '<div class="ft-sub">' + esc(f.corpus) + ' · ' + f.duration_str + '</div></div>';
    b.addEventListener('click', () => selectFilm(f.id, 0, false));
    tabs.appendChild(b);
  });

  /* ---------- highlight wall ---------- */
  const wall = document.getElementById('highlight-wall');
  DATA.films.forEach(f => {
    const card = document.createElement('div');
    card.className = 'hl-card';
    card.title = 'Watch the full film (' + f.duration_str + ')';
    card.innerHTML =
      '<video muted loop playsinline autoplay preload="none" poster="' + f.poster + '" src="static/videos/previews/' + f.id + '.mp4"></video>' +
      '<div class="hl-meta"><div class="hl-title">' + esc(f.title) + '</div>' +
      '<div class="hl-sub">' + esc(f.corpus) + ' · full film ' + f.duration_str + '</div></div>';
    card.addEventListener('click', () => {
      selectFilm(f.id, f.highlight_window.start, true);
      document.getElementById('films').scrollIntoView({ behavior: 'smooth' });
    });
    wall.appendChild(card);
  });

  /* ---------- comparisons (two clips driven by one transport) ---------- */
  const list = document.getElementById('comparison-list');
  DATA.comparisons.forEach((c, i) => {
    const film = byId[c.film];
    const short = film.brief.length > 320 ? film.brief.slice(0, 320).replace(/\s+\S*$/, '') + '…' : film.brief;
    const box = document.createElement('div');
    box.className = 'cmp';
    box.innerHTML =
      '<div class="cmp-head"><span class="cmp-title">' + esc(film.title) + '</span>' +
      '<span class="tag-chip">' + esc(film.corpus) + '</span><span class="tag-chip">vs. ' + esc(c.name) + '</span></div>' +
      '<div class="cmp-brief"><b>Brief:</b> ' + esc(short) +
      (short !== film.brief ? ' <a href="#films" data-film="' + film.id + '">full brief</a>' : '') + '</div>' +
      '<div class="cmp-grid">' +
      '<div class="cmp-cell"><video preload="none" playsinline muted poster="' + film.poster + '" src="' + c.evoreel + '"></video><span class="cmp-label is-ours">EvoReel (ours)</span></div>' +
      '<div class="cmp-cell"><video preload="none" playsinline muted src="' + c.baseline_video + '"></video><span class="cmp-label">' + esc(c.name) + '</span></div>' +
      '</div>' +
      '<div class="cmp-bar">' +
      '<button class="button is-small is-rounded cmp-play"><span class="icon"><i class="fas fa-play"></i></span></button>' +
      '<input type="range" min="0" max="1000" value="0" aria-label="Scrub both clips">' +
      '<span class="select is-small"><select class="cmp-audio" aria-label="Audio">' +
      '<option value="none">Sound off</option><option value="0">Sound: EvoReel</option><option value="1">Sound: ' + esc(c.name) + '</option></select></span>' +
      '<a href="#films" class="cmp-full" data-film="' + film.id + '">EvoReel full film (' + film.duration_str + ')</a> · ' +
      '<a href="' + c.baseline_full + '" target="_blank" rel="noopener">' + esc(c.name) + ' full film</a>' +
      '</div>';
    list.appendChild(box);

    const vids = [...box.querySelectorAll('video')], range = box.querySelector('input[type=range]');
    const btn = box.querySelector('.cmp-play');
    const longest = () => Math.max(...vids.map(v => v.duration || 0));
    const setIcon = playing => { btn.innerHTML = '<span class="icon"><i class="fas fa-' + (playing ? 'pause' : 'play') + '"></i></span>'; };
    const play = () => { vids.forEach(v => { if (v.currentTime < v.duration - 0.05 || !v.duration) v.play().catch(() => {}); }); setIcon(true); };
    const pause = () => { vids.forEach(v => v.pause()); setIcon(false); };
    btn.addEventListener('click', () => (vids[0].paused ? play() : pause()));
    vids.forEach(v => v.addEventListener('click', () => (vids[0].paused ? play() : pause())));
    vids[0].addEventListener('timeupdate', () => {
      const d = longest();
      if (d) range.value = 1000 * Math.max(...vids.map(v => v.currentTime)) / d;
    });
    // restart both together once the longer clip ends, so they stay aligned
    vids.forEach(v => v.addEventListener('ended', () => {
      if (vids.every(x => x.ended || x.paused)) { vids.forEach(x => { x.currentTime = 0; }); if (box.dataset.visible === '1') play(); }
    }));
    range.addEventListener('input', () => {
      const t = longest() * range.value / 1000;
      vids.forEach(v => { v.currentTime = Math.min(t, (v.duration || t) - 0.05); });
    });
    box.querySelector('.cmp-audio').addEventListener('change', e => {
      vids.forEach((v, k) => { v.muted = String(k) !== e.target.value; });
    });
    box.querySelectorAll('[data-film]').forEach(a => a.addEventListener('click', ev => {
      ev.preventDefault();
      selectFilm(a.dataset.film, 0, false);
      document.getElementById('films').scrollIntoView({ behavior: 'smooth' });
    }));
    // play only while on screen
    new IntersectionObserver(entries => entries.forEach(en => {
      box.dataset.visible = en.isIntersecting ? '1' : '0';
      if (en.isIntersecting) { vids.forEach(v => { if (v.preload === 'none') v.preload = 'auto'; }); play(); }
      else pause();
    }), { threshold: 0.5 }).observe(box);
  });

  /* pause wall previews that are off screen to save CPU */
  new IntersectionObserver(entries => entries.forEach(en => {
    en.target.querySelectorAll('video').forEach(v => (en.isIntersecting ? v.play().catch(() => {}) : v.pause()));
  }), { threshold: 0.1 }).observe(wall);

  /* ---------- page chrome: scroll progress, card glow, reveal on scroll, copy BibTeX ---------- */
  const root = document.documentElement;
  let frame = null;
  const updateProgress = () => {
    const max = Math.max(root.scrollHeight - innerHeight, 1);
    root.style.setProperty('--scroll-progress', Math.min(100, 100 * scrollY / max) + '%');
    frame = null;
  };
  addEventListener('scroll', () => { if (frame === null) frame = requestAnimationFrame(updateProgress); }, { passive: true });
  updateProgress();

  document.querySelectorAll('[data-glow-card]').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--glow-x', (100 * (e.clientX - r.left) / r.width) + '%');
      card.style.setProperty('--glow-y', (100 * (e.clientY - r.top) / r.height) + '%');
    });
    card.addEventListener('pointerleave', () => { card.style.removeProperty('--glow-x'); card.style.removeProperty('--glow-y'); });
  });

  const reveal = document.querySelectorAll('.publication-title, .publication-authors, .publication-links, .hero-research-note, ' +
    '.hero-media-shell, .section-heading, .abstract-panel, .paper-figure, .section-lead, .film-tabs, .cmp, .citation-card');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    reveal.forEach((n, i) => { n.classList.add('scroll-reveal'); n.style.setProperty('--reveal-delay', (i % 4) * 70 + 'ms'); io.observe(n); });
  }

  const copyBtn = document.getElementById('copy-citation');
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('citation-bibtex-text').textContent).then(() => {
      copyBtn.classList.add('is-copied');
      copyBtn.innerHTML = '<span class="icon is-small"><i class="fas fa-check"></i></span>';
      setTimeout(() => {
        copyBtn.classList.remove('is-copied');
        copyBtn.innerHTML = '<span class="icon is-small"><i class="far fa-copy"></i></span>';
      }, 1600);
    });
  });

  /* ---------- deep links: #film=e05&t=92 ---------- */
  function fromHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    if (p.has('film') && byId[p.get('film')]) {
      selectFilm(p.get('film'), parseFloat(p.get('t') || '0'), false);
      document.getElementById('films').scrollIntoView();
      return true;
    }
    return false;
  }
  window.addEventListener('hashchange', fromHash);
  if (!fromHash()) selectFilm(DATA.films[0].id, 0, false);
})();
