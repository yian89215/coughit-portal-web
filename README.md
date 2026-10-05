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
python3 build.py        # writes ../assets/coughit-demo.mp4 and video-poster.jpg
```

Timeline (53 s): title card, "It starts with a cough." (app listens and
catches a cough, real simulator recording), "Each cough becomes a track."
(four coughs stack into one waveform), "Three coughs, one piece." (piano roll),
end card.

- `render.py` draws the cards and the two animated scenes (2x supersampled).
- `build.py` holds the timeline, cuts the simulator recording, mixes audio
  (cough clip + drum/trio demo excerpts, normalized and soft-limited), encodes.
- `source/` has the inputs: the simulator recording, the demo audio and MIDI
  visualization data copied from the app's `assets/demo/`.
- The iOS notification banner in the recording (it carries the colored app icon)
  is painted white; the screen underneath is blank at that moment.
