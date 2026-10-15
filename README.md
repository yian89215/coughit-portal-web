# CoughIt site v2

Minimal-art redesign that matches the app (variant A): white paper, ink
`#111111`, pure grays, square corners, 1.5px black rules. Red is the only hue
and appears only for "a cough was caught".

```
index.html      home: hero, overview video, demo teaser, usability study
demo.html       Demo (Solo) and Co-create players, download block
styles.css      shared styles, three colour themes (white, purple, black)
script.js       theme and hero art pickers, players, demo drawing
assets/         coughit-demo.mp4, video-poster.jpg, demo audio and MIDI, favicon
tools/          build-demo-data.py (writes assets/demo/data.js)
video/          how the video is made (reproducible)
TODO.md         open items
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
- `index.html`: "CoughIt" and the tagline, hero artwork drawn from the demo data,
  download block (App Store; Android is a "Coming soon" placeholder), Overview
  with the video, a Demo teaser, "Invitation: Usability Study" (English first,
  then Traditional Chinese) and a hidden "How much do you know about your
  cough?" section.
- `demo.html`: Demo (Solo Drum, Solo String Trio: one cough, one instrument) and
  Co-create (Co-create Drum, Co-create String Trio), then the download block.
- Demo audio, MIDI and waveform peaks live in `assets/demo/`. The page reads
  `assets/demo/data.js` (embedded copy, so `file://` works). After changing any
  JSON or WAV in `assets/demo/`, run `python3 tools/build-demo-data.py`.
- Preview switches (query string): `?draft` shows hidden sections that still
  wait for assets (`draft-only`), `?theme=white|purple|black`, `?art=` picks the
  hero artwork. The Art and Color selectors at the bottom right are temporary
  controls for demos. Remove them (`.demo-controls`, the picker code in
  `script.js`) once one art and one colour are chosen.
- Wording follows the app and the video: Solo, Co-create, "Music (Kick)", full
  instrument names (Kick, Snare, Closed Hi-hat, Open Hi-hat, Mid Tom, Low Tom,
  Crash Cymbal). No em dashes.
- Respects `prefers-reduced-motion`; keyboard and screen-reader labels on the
  player; no horizontal scroll at phone width.
- Study pages: English `https://dreamalitylab.cc/coughit-eng/`, Traditional
  Chinese `https://dreamalitylab.cc/coughit-user-study/`. Contact:
  `coughit121@gmail.com`.

## Video (`video/`)
Needs `ffmpeg`, Python 3 with Pillow and numpy, and macOS (uses the SF font).

```bash
cd video
python3 build.py                 # writes ../assets/coughit-demo.mp4 and video-poster.jpg
python3 build.py WORK OUT_DIR    # build a draft elsewhere without touching assets/
```

Timeline (about 63 s): title question "Can a cough become music?", "It starts
with a cough." (app listens and catches a cough, simulator recording), "A cough
becomes a rhythm." (web demo, first Crash Cymbal example: cough waveform to MIDI), "A cough becomes
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
