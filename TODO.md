# CoughIt site v2: TODO

Everything unfinished is marked on the page by an element with class `todo`
(dashed box). While `<body class="draft">` is set they are visible. When the
copy is final: replace each `.todo` element and remove the `draft` class.

## Copy (owner: teammate writing it)
- [ ] **About** (`#about`, `data-todo="about-copy"`): 3 to 5 sentences taken from
      the paper's already revised text. Do not rewrite it.
- [ ] **Join** (`#join`, `data-todo="join-copy"`): one sentence inviting people
      to take part.
- Rules from the 1003 meeting: no em dashes anywhere; consistent sentence
  structure; do not use "quietly listen" or "all built from that one cough";
  keep the tone light, not pressuring.

## Contact (footer, `data-todo="contact"`)
- [ ] A short, project-specific email (not the lab's shared one).
- [ ] One line such as "For collaboration, press, or participation, contact ...".

## Check before publishing
- [ ] **The study page says the study period ended on September 30, 2026.**
      "Join the study" links to it. Decide whether to keep the button, change
      the wording, or update that page.
- [ ] Android: the old page linked a Google Drive APK folder. v2 sends Android
      users to the study page instead. Confirm that is acceptable.
- [ ] Video: `assets/coughit-demo.mp4` (53 s, 1080p). Watch it with sound on.
      Everyone on the team should review it before it goes to the professor.
- [ ] `og:image` and the video poster use `assets/video-poster.jpg`.
- [ ] Hosting: copy this folder as-is. No build step.

## Known limits of the video
- Audio is 16 kHz mono (the demo assets), so highs are limited.
- The drum scene names four coughs (crash, snare, hi-hat, kick). Those are the
  four drums that are audibly driven by a cough in this demo; the other three
  pieces only appear later as generated fill.
- The Trio ending is drawn from the demo's MIDI data in the app's piano-roll
  style; it is not a screen recording (the in-app demo screen is not polished
  enough to film).
