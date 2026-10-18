# CoughIt site: TODO

Last updated 2026-10-18 (after the 1017 meeting). Wording must match the app and
the video; no em dashes. The professor's rules: write from the visitor's point
of view, be polite (please, questions), say experience not try, never call it an
art project, take sentences from the paper.

## Waiting on someone
- [ ] **Check every sentence against the latest paper** and have another person
      read it. The copy in `index.html`, `demo.html` and `art.html` was drafted
      from the 1017 notes; "free for iPhone" is from the App Store page, "works
      in the background" is from the paper (the App Store page does not say it).
- [ ] Hero tagline: the professor said the "Transform your ___ into music" line
      needs to change but did not say to what. Ask, then edit `.tagline-sub`.
- [ ] Contact line wording (`.foot-contact`) is a draft.
- [ ] Android: after Apple approves and the Android build is out, add a second
      badge in the `download-row` (no "coming soon").
- [ ] Final web address: set `og:image` to a full URL and add `og:url` (the lab
      pages embed this site, so check where the tags must live).
- [ ] Pick the version, hero art and colour with the professor, then remove the
      style picker (see `README.md`).
- [ ] Hero longitude ring uses sample counts. Replace with real data later.
- [ ] Demo section: the professor said what we do is not strictly co-creation.
      The demo still plays several coughs as one track. Ask whether to keep it.
- [ ] Art version: keep or drop the Film section?
- [ ] Study pages on dreamalitylab.cc state 2026/11/30; check against "by the end
      of the year" (not this repo).

## Needs App screens (assets/app/)
- [ ] `tracking-weekly.png`, `tracking-sleep.png`, `tracking-compare.png`
      (iPhone portrait, white, no banner, demo users only).
- [ ] Then fill `#your-cough` in `index.html` and drop `draft-only`.

## Done (1017)
- [x] Wording: experience instead of try/voice, no "Coming soon", polite download
      question, visitor-first facts (free, background), no "art project", Demo
      wording (single cough, sound of an instrument), sentence-case titles.
- [x] Two versions: `index.html` (paper) and `art.html` (art), same look.
- [x] Hero circle carries data: one bar per longitude, grey depth = more coughs
      (illustration).
- [x] Purple as accent only (rules, titles, menu, contact, buttons).
- [x] Menu bigger; the space under a word scales with the word's size.
- [x] Style picker with Version, Art and Color for the professor.

## Before showing it
- [ ] Click every link, button, and Demo map pin, including both study pages.
- [ ] 375 px width: no horizontal scroll (checked for index, art, demo).
- [ ] Open `index.html` straight from disk and from GitHub Pages.
