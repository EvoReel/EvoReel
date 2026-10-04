# EvoReel project page

Static project page for *EvoReel: Evolving Harness for Long-Horizon Video Generation*,
served with GitHub Pages straight from the `main` branch (no build step on GitHub).

## Layout

```
index.html                    page markup (sections: title, highlight wall, abstract, method, full films, comparisons, BibTeX)
static/css/index.css          page styles
static/js/chapter-player.js   chapter-aware player: act bands, scene ticks, highlight band, hover thumbnails, keyboard
static/js/index.js            builds the highlight wall, film tabs, synced comparisons and #film=…&t=… deep links
static/data/films.js          film metadata (title, brief, acts, chapters with times, highlight window); generated
static/images/                paper figures, posters, per-chapter thumbnails (thumbs/<film>/NN.jpg)
static/videos/full/           full films (H.264 + AAC, faststart)
static/videos/highlights/     ~30 s highlight clips used in the comparisons
static/videos/previews/       12 s muted loops for the highlight wall
static/videos/gallery/        6 s muted moments for the scrolling gallery (static/data/gallery.js)
static/vendor/                Bulma 1.0 and Font Awesome Free 6 (MIT / OFL / CC BY 4.0), vendored; only the Manrope / Space Mono web fonts come from Google Fonts
```

## Preview locally

Video seeking needs HTTP Range support, so use a server that implements it, for example

```bash
npx http-server -p 8000 .        # or any static server with Range support
```

then open <http://localhost:8000/>. Python's built-in `http.server` cannot seek inside videos.

## Player controls

Click the timeline or a chapter to jump; <kbd>[</kbd> / <kbd>]</kbd> previous / next chapter,
<kbd>←</kbd> / <kbd>→</kbd> ±5 s, <kbd>space</kbd> play/pause, <kbd>m</kbd> mute, <kbd>f</kbd> fullscreen,
<kbd>0</kbd>–<kbd>9</kbd> jump to 0–90 %. The link button copies a URL such as `#film=e05&t=92`.

## Size limits

GitHub rejects files over 100 MB and recommends Pages sites under 1 GB. The largest video here is ~63 MB
and the whole site is under 500 MB.

## Credits

Layout adapted from the [Nerfies](https://github.com/nerfies/nerfies.github.io) project page template (CC BY-SA 4.0).
