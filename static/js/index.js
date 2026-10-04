/* Page wiring: highlight wall, film tabs + chapter player, synced comparisons, moments gallery, deep links. */
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

  /* ---------- hover magnifier (2.5x canvas lens), shared by the moments gallery and the comparisons ---------- */
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let lensActive = null, lensPointer = null, lensFrame = null;
  function closeLens() {
    if (!lensActive) return;
    const a = lensActive;
    a.box.classList.remove('is-magnifying');
    a.canvas.hidden = true;
    lensActive = lensPointer = null;
    if (lensFrame !== null) { cancelAnimationFrame(lensFrame); lensFrame = null; }
    if (a.onClose) a.onClose();
  }
  function renderLens() {
    if (!lensActive || !lensPointer) { lensFrame = null; return; }
    const { box, video, canvas, margin } = lensActive;
    const vr = video.getBoundingClientRect(), br = box.getBoundingClientRect();
    const x = lensPointer.clientX, y = lensPointer.clientY;
    const over = x >= vr.left && x <= vr.right && y >= vr.top && y <= vr.bottom;
    if (!over || video.readyState < 2 || !video.videoWidth) {
      canvas.hidden = true;
      lensFrame = requestAnimationFrame(renderLens);
      return;
    }
    canvas.hidden = false;
    const lw = canvas.offsetWidth, lh = canvas.offsetHeight;
    canvas.style.left = Math.max(margin, Math.min(br.width - lw - margin, x - br.left - lw / 2)) + 'px';
    canvas.style.top = Math.max(margin, Math.min(br.height - lh - margin, y - br.top - lh / 2)) + 'px';
    // visible region of the frame (object-fit: cover crops, contain letterboxes)
    const zoom = 2.5, elAspect = vr.width / vr.height, vAspect = video.videoWidth / video.videoHeight;
    let vx = 0, vy = 0, vw = video.videoWidth, vh = video.videoHeight, dw = vr.width, dh = vr.height, ox = 0, oy = 0;
    const cover = getComputedStyle(video).objectFit === 'cover';
    if (cover) {
      if (vAspect > elAspect) { vw = vh * elAspect; vx = (video.videoWidth - vw) / 2; }
      else { vh = vw / elAspect; vy = (video.videoHeight - vh) / 2; }
    } else if (vAspect > elAspect) { dh = vr.width / vAspect; oy = (vr.height - dh) / 2; }
    else { dw = vr.height * vAspect; ox = (vr.width - dw) / 2; }
    const nx = Math.min(1, Math.max(0, (x - vr.left - ox) / dw)), ny = Math.min(1, Math.max(0, (y - vr.top - oy) / dh));
    const sw = (lw / dw) * vw / zoom, sh = (lh / dh) * vh / zoom;
    const sx = Math.max(vx, Math.min(vx + vw - sw, vx + nx * vw - sw / 2));
    const sy = Math.max(vy, Math.min(vy + vh - sh, vy + ny * vh - sh / 2));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    lensFrame = requestAnimationFrame(renderLens);
  }
  function attachLens(box, video, opts) {
    if (!canHover) return;
    opts = opts || {};
    const canvas = document.createElement('canvas');
    canvas.className = 'video-magnifier-lens';
    canvas.width = canvas.height = 260;
    canvas.hidden = true;
    canvas.setAttribute('aria-hidden', 'true');
    box.appendChild(canvas);
    box.addEventListener('pointerenter', e => {
      if (e.pointerType === 'touch') return;
      closeLens();
      lensActive = { box, video, canvas, margin: opts.margin || 6, onClose: opts.onClose };
      lensPointer = { clientX: e.clientX, clientY: e.clientY };
      box.classList.add('is-magnifying');
      if (opts.onOpen) opts.onOpen();
      lensFrame = requestAnimationFrame(renderLens);
    });
    box.addEventListener('pointermove', e => { if (lensActive && lensActive.box === box) lensPointer = { clientX: e.clientX, clientY: e.clientY }; });
    box.addEventListener('pointerleave', () => { if (lensActive && lensActive.box === box) closeLens(); });
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLens(); });
  addEventListener('blur', closeLens);
  document.querySelectorAll('.cmp-cell').forEach(cell => attachLens(cell, cell.querySelector('video')));

  /* ---------- moments gallery: endless carousel; hover snaps the card to center and zooms ---------- */
  const track = document.getElementById('moments-track');
  const moments = window.EVOREEL_GALLERY || [];
  if (track && moments.length > 1) {
    const viewport = track.parentElement;
    const cardHtml = m => '<article class="continuous-video-card" data-film="' + m.film + '" data-t="' + m.t + '">' +
      '<video data-src="' + m.src + '" poster="' + m.poster + '" muted loop playsinline preload="none"></video>' +
      '<div class="moment-meta"><span class="moment-title" title="' + esc(m.label) + '">' + esc(m.title) + '</span>' +
      '<button type="button" class="moment-open">Watch at ' + fmtTime(m.t) + '</button></div></article>';
    // two copies so the -50% keyframe loops seamlessly
    track.innerHTML = moments.map(cardHtml).join('') + moments.map(cardHtml).join('');
    const cards = Array.from(track.children);
    cards.slice(moments.length).forEach(c => c.setAttribute('aria-hidden', 'true'));

    let loopDistance = 0, duration = 80, snapFrame = null;
    const updateDuration = () => {
      loopDistance = cards[moments.length].offsetLeft - cards[0].offsetLeft;
      duration = Math.max(80, loopDistance / 220);
      track.style.setProperty('--carousel-duration', duration + 's');
    };
    requestAnimationFrame(updateDuration);
    if ('ResizeObserver' in window) new ResizeObserver(updateDuration).observe(viewport);
    else addEventListener('resize', updateDuration);

    const videos = cards.map(c => c.querySelector('video'));
    const playVideo = v => {
      if (!v.getAttribute('src')) { v.src = v.dataset.src; v.preload = 'auto'; }
      v.play().catch(() => {});
    };
    if ('IntersectionObserver' in window) {
      const vo = new IntersectionObserver(entries => entries.forEach(en => (en.isIntersecting ? playVideo(en.target) : en.target.pause())),
        { root: viewport, rootMargin: '0px 50% 0px 50%' });
      // only observe while the section is on screen, so off-page clips stay unloaded
      new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) videos.forEach(v => vo.observe(v));
        else { videos.forEach(v => { vo.unobserve(v); v.pause(); }); }
      }), { rootMargin: '200px 0px' }).observe(viewport);
    } else videos.forEach(playVideo);

    const translateX = t => {
      const m = t && t.match(/^matrix(3d)?\((.+)\)$/);
      if (!m) return 0;
      const v = m[2].split(',').map(Number);
      return m[1] ? v[12] : v[4];
    };
    const resume = () => {
      if (snapFrame !== null) { cancelAnimationFrame(snapFrame); snapFrame = null; }
      const x = translateX(getComputedStyle(track).transform);
      const offset = loopDistance > 0 ? ((-x % loopDistance) + loopDistance) % loopDistance : 0;
      track.style.setProperty('--carousel-delay', -duration * offset / Math.max(loopDistance, 1) + 's');
      track.style.transition = 'none';
      track.style.animation = 'none';
      track.style.transform = '';
      track.getBoundingClientRect();
      track.style.animation = '';
    };
    const snapToCenter = card => {
      const x = translateX(getComputedStyle(track).transform);
      track.style.animation = 'none';
      track.style.transition = 'none';
      track.style.transform = 'translate3d(' + x + 'px,0,0)';
      track.getBoundingClientRect();
      const vr = viewport.getBoundingClientRect(), cr = card.getBoundingClientRect();
      const target = x + (vr.left + vr.width / 2) - (cr.left + cr.width / 2);
      track.style.transition = 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)';
      snapFrame = requestAnimationFrame(() => { track.style.transform = 'translate3d(' + target + 'px,0,0)'; snapFrame = null; });
    };
    const hint = document.querySelector('#moments .carousel-hint');
    if (hint && !canHover) hint.textContent = 'Tap a clip to open the film at that moment';
    cards.forEach((card, i) => attachLens(card, videos[i], { margin: 8, onOpen: () => snapToCenter(card), onClose: resume }));

    track.addEventListener('click', e => {
      const card = e.target.closest('.continuous-video-card');
      if (!card) return;
      closeLens();
      selectFilm(card.dataset.film, parseFloat(card.dataset.t), true);
      document.getElementById('films').scrollIntoView({ behavior: 'smooth' });
    });
  }

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
    '.hero-media-shell, .section-heading, .abstract-panel, .paper-figure, .section-lead, .film-tabs, .cmp, .results-card, .continuous-carousel, ' +
    '.carousel-hint, .citation-card');
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); }
    }), { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    reveal.forEach((n, i) => { n.classList.add('scroll-reveal'); n.style.setProperty('--reveal-delay', (i % 4) * 70 + 'ms'); io.observe(n); });
  }

  const copyBtn = document.getElementById('copy-citation');
  const copyText = text => {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  };
  copyBtn.addEventListener('click', () => {
    copyText(document.getElementById('citation-bibtex-text').textContent).then(() => {
      copyBtn.classList.add('is-copied');
      copyBtn.innerHTML = '<span class="icon is-small"><i class="fas fa-check"></i></span>';
      setTimeout(() => {
        copyBtn.classList.remove('is-copied');
        copyBtn.innerHTML = '<span class="icon is-small"><i class="far fa-copy"></i></span>';
      }, 1600);
    }).catch(() => {});
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
