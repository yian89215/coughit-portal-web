# CoughIt site v2

Minimal-art redesign that matches the app (variant A): white paper, ink
`#111111`, pure grays, square corners, 1.5px black rules. Red is the only hue
and appears only for "a cough was caught".

```
index.html  styles.css  script.js     the page (no build step)
assets/                               coughit-demo.mp4, video-poster.jpg, favicon.svg
video/                                how the video is made (reproducible)
TODO.md                               open items (copy, contact, checks)
```

## Preview

```bash
python3 -m http.server 4180
# open http://localhost:4180
```

## Collaboration and deployment

- Work together through GitHub using short-lived branches and pull requests.
- Every push to `main` automatically deploys the current site with GitHub
  Actions and GitHub Pages.
- In the GitHub repository, set **Settings > Pages > Build and deployment >
  Source** to **GitHub Actions** once after creating the repository.
- No build command or dependency installation is required.

## Page
- Hero tagline `Transform your cough into music.` with the app's start button
  replayed below it (hollow ring, filled dot while listening, red on a cough).
- 01 Watch (video), 02 About (TODO copy), 03 Join (study page + App Store).
- System font stack (SF on Apple devices, Inter elsewhere), same as the app.
- Respects `prefers-reduced-motion`; keyboard and screen-reader labels on the
  player; no horizontal scroll at phone width.
- Study page links: English `https://dreamalitylab.cc/coughit-eng/`,
  Traditional Chinese `https://dreamalitylab.cc/coughit/`.

## Video (`video/`)
Needs `ffmpeg`, Python 3 with Pillow and numpy, and macOS (uses the SF font).

```bash
cd video
python3 build.py                 # writes ../assets/coughit-demo.mp4 and video-poster.jpg
python3 build.py WORK OUT_DIR    # build a draft elsewhere without touching assets/
```

Timeline (about 63 s): title question "Can a cough become music?", "It starts
with a cough." (app listens and catches a cough, simulator recording), "A cough
becomes a rhythm." (web demo Crash 1: cough waveform to MIDI), "A cough becomes
a melody." (web demo Trio 1), "Now imagine many coughs, played together.", two
map-screen clips (drum, trio, 10 s each), end card. The word "co-create" never
appears on screen.

- `render.py` draws the cards and the two cough-to-music scenes (2x supersampled).
  Audio and MIDI come from `assets/demo/` (the same files the page plays).
- `build.py` holds the timeline, cuts the simulator recording, mixes audio
  (normalized and soft-limited), encodes. Map clips are optional: it uses
  `source/map_drum.mp4` and `source/map_trio.mp4` when they exist.
- `prep_map.py RAW.mov drum|trio` turns a raw simulator recording of the app's
  full-screen map into those clips: map and piano roll side by side, grayscale
  with red kept, no controls and no tab row. Raw recordings are kept as
  `source/raw_map_*.mov`.
- `source/` also holds the older phone recording (`app_listen_cough.mov`, from
  the previous app UI) and the earlier demo audio and MIDI visualization data.
- The iOS notification banner in the phone recording (it carries the colored
  app icon) is painted white; the screen underneath is blank at that moment.
