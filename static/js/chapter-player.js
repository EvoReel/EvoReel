/* Chapter-aware video player for long films.
 * The timeline shows the script's acts as colored bands, scene chapters as ticks,
 * the highlight window as a gold band, and a thumbnail tooltip on hover. */
(function () {
  'use strict';

  const ACT_COLORS = ['#c96442', '#5a7fa8', '#7d8c5a'];  // clay, blue, olive (films have three acts)

  function fmtTime(t) {
    t = Math.max(0, t || 0);
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  class ChapterPlayer {
    constructor() {
      this.$ = id => document.getElementById(id);
      this.root = this.$('player');
      this.video = this.$('player-video');
      this.film = null;
      this.chapterIdx = -1;
      this.dragging = false;
      this.bindControls();
    }

    /* ---------- loading a film ---------- */
    load(film, startAt, autoplay) {
      this.film = film;
      this.chapterIdx = -1;
      this.video.pause();
      this.root.classList.remove('is-playing');
      this.$('btn-play').innerHTML = '<i class="fas fa-play"></i>';
      this.$('player-chapter-flag').classList.remove('is-visible');
      this.video.src = film.video;
      this.video.poster = film.poster;
      this.video.playbackRate = parseFloat(this.$('speed').value);
      this.$('time-dur').textContent = fmtTime(film.duration);
      this.renderTimeline();
      this.renderChapterList();
      this.renderInfo();
      const seekTo = startAt || 0;
      const start = () => {
        if (seekTo) this.video.currentTime = seekTo;
        if (autoplay) this.video.play().catch(() => {});
        this.update();
      };
      if (this.video.readyState >= 1) start();
      else this.video.addEventListener('loadedmetadata', start, { once: true });
    }

    get duration() {
      return (this.video.duration && isFinite(this.video.duration)) ? this.video.duration : this.film.duration;
    }

    pct(t) { return (100 * t / this.duration) + '%'; }

    renderTimeline() {
      const f = this.film, acts = this.$('timeline-acts'), track = this.$('timeline-track'), ticks = this.$('timeline-ticks');
      acts.innerHTML = '';
      ticks.innerHTML = '';
      track.querySelectorAll('.timeline-act-band').forEach(n => n.remove());
      f.acts.forEach((a, i) => {
        const left = 100 * a.start / f.duration, width = 100 * (a.end - a.start) / f.duration;
        const lab = el('div', 'timeline-act', esc(a.label + (a.name ? ' · ' + a.name : '')));
        lab.style.left = left + '%';
        lab.style.width = width + '%';
        lab.title = a.label + (a.name ? ': ' + a.name : '') + ' (' + fmtTime(a.start) + ')';
        lab.addEventListener('click', () => this.seek(a.start, true));
        acts.appendChild(lab);
        const band = el('div', 'timeline-act-band');
        band.style.left = left + '%';
        band.style.width = width + '%';
        band.style.background = ACT_COLORS[i % ACT_COLORS.length] + '55';
        track.insertBefore(band, track.firstChild);
      });
      f.chapters.forEach((c, i) => {
        if (i === 0) return;
        const isAct = f.acts.some(a => Math.abs(a.start - c.t) < 0.01);
        const tick = el('div', 'timeline-tick' + (isAct ? ' is-act' : ''));
        tick.style.left = (100 * c.t / f.duration) + '%';
        ticks.appendChild(tick);
      });
      const hl = this.$('timeline-hl');
      hl.style.left = (100 * f.highlight_window.start / f.duration) + '%';
      hl.style.width = (100 * (f.highlight_window.end - f.highlight_window.start) / f.duration) + '%';
      hl.title = 'Highlight clip';
    }

    renderChapterList() {
      const f = this.film, box = this.$('chapters');
      box.innerHTML = '';
      this.chapterEls = [];
      let lastAct = -1;
      f.chapters.forEach((c, i) => {
        if (c.act !== lastAct) {
          lastAct = c.act;
          const a = f.acts[c.act];
          const h = el('div', 'ch-act', esc(a.label) + (a.name ? ' <span>· ' + esc(a.name) + '</span>' : ''));
          h.style.setProperty('--act-color', ACT_COLORS[c.act % ACT_COLORS.length]);
          box.appendChild(h);
        }
        const inHl = c.t < f.highlight_window.end && c.end > f.highlight_window.start;
        const item = el('div', 'ch-item');
        item.innerHTML =
          '<img loading="lazy" src="' + c.thumb + '" alt="">' +
          '<div><div class="ch-time">' + fmtTime(c.t) + (inHl ? '<i class="fas fa-star ch-star" title="In highlight clip"></i>' : '') + '</div>' +
          '<div class="ch-label">' + esc(c.label) + '</div>' +
          (c.desc ? '<div class="ch-desc" title="' + esc(c.desc) + '">' + esc(c.desc) + '</div>' : '') + '</div>';
        item.addEventListener('click', () => this.seek(c.t, true));
        box.appendChild(item);
        this.chapterEls.push(item);
      });
      this.syncListHeight();
    }

    renderInfo() {
      const f = this.film;
      this.$('film-info').innerHTML =
        '<div class="fi-head"><span class="fi-title">' + esc(f.title) + '</span>' +
        '<span class="tag-chip">' + esc(f.corpus) + '</span>' +
        '<span class="tag-chip">' + f.duration_str + ' · ' + f.num_shots + ' shots · ' + f.chapters.length + ' scenes</span>' +
        (f.figure ? '<span class="tag-chip">Paper ' + esc(f.figure) + '</span>' : '') + '</div>' +
        '<p class="fi-logline">' + esc(f.logline) + '</p>' +
        '<details><summary>Input brief (verbatim, the only input to the system)</summary><pre>' + esc(f.brief) + '</pre></details>';
    }

    /* the chapter list matches the player height on wide screens */
    syncListHeight() {
      const box = this.$('chapters');
      if (window.matchMedia('(max-width: 1023px)').matches) { box.style.maxHeight = ''; return; }
      box.style.maxHeight = this.root.getBoundingClientRect().height + 'px';
    }

    /* ---------- state ---------- */
    chapterAt(t) {
      const ch = this.film.chapters;
      let i = 0;
      while (i + 1 < ch.length && ch[i + 1].t <= t + 0.05) i++;
      return i;
    }

    update() {
      if (!this.film) return;
      const t = this.video.currentTime, d = this.duration;
      if (!this.dragging) {
        this.$('timeline-progress').style.width = this.pct(t);
        this.$('timeline-knob').style.left = this.pct(t);
      }
      this.$('time-cur').textContent = fmtTime(t);
      const b = this.video.buffered;
      if (b.length) this.$('timeline-buffer').style.width = (100 * b.end(b.length - 1) / d) + '%';
      const idx = this.chapterAt(t);
      if (idx !== this.chapterIdx) this.onChapterChange(idx);
    }

    onChapterChange(idx) {
      const prev = this.chapterIdx;
      this.chapterIdx = idx;
      const c = this.film.chapters[idx];
      this.chapterEls.forEach((e, i) => e.classList.toggle('is-active', i === idx));
      const act = this.film.acts[c.act];
      this.$('ctl-chapter').textContent = act.label + ' · ' + c.label;
      this.$('timeline-acts').querySelectorAll('.timeline-act').forEach((e, i) => e.classList.toggle('is-active', i === c.act));
      const item = this.chapterEls[idx], box = this.$('chapters');
      if (item && box.scrollHeight > box.clientHeight) {
        const top = item.offsetTop - box.clientHeight / 3;
        box.scrollTo({ top: Math.max(0, top), behavior: prev < 0 ? 'auto' : 'smooth' });
      }
      if (prev >= 0 && !this.video.paused) this.flashChapter(act.label + ' · ' + c.label);
    }

    flashChapter(text) {
      const flag = this.$('player-chapter-flag');
      flag.textContent = text;
      flag.classList.add('is-visible');
      clearTimeout(this.flagTimer);
      this.flagTimer = setTimeout(() => flag.classList.remove('is-visible'), 2200);
    }

    /* ---------- actions ---------- */
    seek(t, play) {
      this.video.currentTime = Math.min(Math.max(0, t), this.duration - 0.05);
      if (play) this.video.play().catch(() => {});
      this.update();
    }

    step(dir) {
      const ch = this.film.chapters, t = this.video.currentTime;
      let i = this.chapterAt(t);
      if (dir < 0 && t - ch[i].t > 2) { this.seek(ch[i].t); return; } // restart current chapter first
      i = Math.min(Math.max(0, i + dir), ch.length - 1);
      this.seek(ch[i].t);
    }

    togglePlay() { this.video.paused ? this.video.play().catch(() => {}) : this.video.pause(); }

    timeFromEvent(e) {
      const r = this.$('timeline-track').getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      return Math.min(Math.max(0, x / r.width), 1) * this.duration;
    }

    showTip(e) {
      const t = this.timeFromEvent(e), c = this.film.chapters[this.chapterAt(t)];
      const tip = this.$('timeline-tip'), tl = this.$('timeline');
      const r = tl.getBoundingClientRect();
      const x = Math.min(Math.max(96, (e.clientX - r.left)), r.width - 96);
      tip.style.left = x + 'px';
      const img = this.$('timeline-tip-img');
      if (img.getAttribute('src') !== c.thumb) img.src = c.thumb;
      this.$('timeline-tip-label').textContent = this.film.acts[c.act].label + ' · ' + c.label;
      this.$('timeline-tip-time').textContent = fmtTime(t) + '  (scene ' + fmtTime(c.t) + '–' + fmtTime(c.end) + ')';
      tl.classList.add('is-hover');
    }

    copyLink() {
      const url = location.origin + location.pathname + '#film=' + this.film.id + '&t=' + Math.floor(this.video.currentTime);
      history.replaceState(null, '', url);
      if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
      this.flashChapter('Link copied: ' + fmtTime(this.video.currentTime));
    }

    bindControls() {
      const v = this.video, $ = this.$;
      ['timeupdate', 'progress', 'seeked', 'loadedmetadata'].forEach(ev => v.addEventListener(ev, () => this.update()));
      v.addEventListener('play', () => { this.root.classList.add('is-playing'); $('btn-play').innerHTML = '<i class="fas fa-pause"></i>'; });
      v.addEventListener('pause', () => { this.root.classList.remove('is-playing'); $('btn-play').innerHTML = '<i class="fas fa-play"></i>'; });
      v.addEventListener('volumechange', () => {
        $('btn-mute').innerHTML = '<i class="fas fa-volume-' + (v.muted || v.volume === 0 ? 'xmark' : 'high') + '"></i>';
        $('volume').value = v.muted ? 0 : v.volume;
      });
      // keep the custom loop of rAF light: only while playing, for a smooth knob
      const tick = () => { if (!v.paused) { this.update(); requestAnimationFrame(tick); } };
      v.addEventListener('play', () => requestAnimationFrame(tick));

      $('player-overlay').addEventListener('click', () => this.togglePlay());
      v.addEventListener('click', () => this.togglePlay());
      $('btn-play').addEventListener('click', () => this.togglePlay());
      $('btn-prev').addEventListener('click', () => this.step(-1));
      $('btn-next').addEventListener('click', () => this.step(1));
      $('btn-hl').addEventListener('click', () => this.seek(this.film.highlight_window.start, true));
      $('btn-mute').addEventListener('click', () => { v.muted = !v.muted; });
      $('volume').addEventListener('input', e => { v.volume = parseFloat(e.target.value); v.muted = v.volume === 0; });
      $('speed').addEventListener('change', e => { v.playbackRate = parseFloat(e.target.value); });
      $('btn-link').addEventListener('click', () => this.copyLink());
      $('btn-fs').addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else (this.root.requestFullscreen || this.root.webkitRequestFullscreen || (() => {})).call(this.root);
      });
      v.addEventListener('dblclick', () => $('btn-fs').click());

      // timeline scrubbing
      const tl = $('timeline'), track = $('timeline-track');
      const move = e => {
        if (!this.film) return;
        this.showTip(e);
        if (this.dragging) {
          const t = this.timeFromEvent(e);
          $('timeline-progress').style.width = this.pct(t);
          $('timeline-knob').style.left = this.pct(t);
        }
      };
      track.addEventListener('pointerdown', e => {
        this.dragging = true;
        track.setPointerCapture(e.pointerId);
        move(e);
      });
      track.addEventListener('pointerup', e => {
        if (!this.dragging) return;
        this.dragging = false;
        this.seek(this.timeFromEvent(e));
      });
      tl.addEventListener('pointermove', move);
      tl.addEventListener('pointerleave', () => { if (!this.dragging) tl.classList.remove('is-hover'); });

      // auto-hide controls while playing
      const wake = () => {
        this.root.classList.remove('is-idle');
        clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => this.root.classList.add('is-idle'), 2500);
      };
      this.root.addEventListener('pointermove', wake);
      v.addEventListener('play', wake);

      // keyboard: active whenever the player is mostly on screen
      let onScreen = false;
      new IntersectionObserver(en => { onScreen = en[0].isIntersecting; }, { threshold: 0.6 }).observe(this.root);
      document.addEventListener('keydown', e => {
        if (!onScreen || e.ctrlKey || e.metaKey || e.altKey) return;
        if (/^(SELECT|INPUT|TEXTAREA|BUTTON|SUMMARY)$/.test(e.target.tagName) && e.key === ' ') return;
        if (/^(SELECT|INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
        const k = e.key;
        if (k === ' ' || k === 'k') { this.togglePlay(); }
        else if (k === 'ArrowLeft') { this.seek(v.currentTime - 5); }
        else if (k === 'ArrowRight') { this.seek(v.currentTime + 5); }
        else if (k === '[') { this.step(-1); }
        else if (k === ']') { this.step(1); }
        else if (k === 'm') { v.muted = !v.muted; }
        else if (k === 'f') { $('btn-fs').click(); }
        else if (k >= '0' && k <= '9') { this.seek(this.duration * parseInt(k, 10) / 10); }
        else return;
        e.preventDefault();
        wake();
      });
      this.root.addEventListener('click', () => this.root.focus({ preventScroll: true }));
      window.addEventListener('resize', () => this.syncListHeight());
    }
  }

  window.ChapterPlayer = ChapterPlayer;
  window.fmtTime = fmtTime;
  window.escHtml = esc;
})();
