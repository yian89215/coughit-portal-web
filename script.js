// Hero: replays the app's own start button states (idle, listening, cough).
(function () {
  const stage = document.getElementById('listen');
  const caption = document.getElementById('listen-caption');
  if (!stage || !caption) return;

  const text = {
    idle: 'Tap to begin cough detection.',
    listening: 'Tap to end cough detection.',
    cough: 'Tap to end cough detection.'
  };
  const loop = [
    ['idle', 2400],
    ['listening', 3600],
    ['cough', 2200],
    ['listening', 1800]
  ];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function set(state) {
    stage.dataset.state = state;
    caption.textContent = text[state];
  }

  if (reduced) { set('idle'); return; }

  let i = 0;
  (function step() {
    const [state, ms] = loop[i];
    set(state);
    i = (i + 1) % loop.length;
    setTimeout(step, ms);
  })();
})();

// Video player: one thin, site-themed control bar instead of native controls.
(function () {
  const player = document.querySelector('[data-player]');
  if (!player) return;
  const media = player.querySelector('.player-media');
  const toggles = player.querySelectorAll('[data-playtoggle]');
  const track = player.querySelector('[data-track]');
  const fill = player.querySelector('[data-fill]');
  const time = player.querySelector('[data-time]');
  const muteBtn = player.querySelector('[data-mute]');

  const fmt = (s) => {
    if (!isFinite(s)) return '0:00';
    return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  };

  const setPlaying = (playing) => {
    player.classList.toggle('is-playing', playing);
    toggles.forEach((btn) => {
      const play = btn.querySelector('.icon-play');
      const pause = btn.querySelector('.icon-pause');
      if (play) play.hidden = playing;
      if (pause) pause.hidden = !playing;
      btn.setAttribute('aria-label', playing ? 'Pause video' : 'Play video');
    });
  };

  toggles.forEach((btn) => btn.addEventListener('click', () => {
    if (media.paused) media.play(); else media.pause();
  }));
  media.addEventListener('click', () => { if (media.paused) media.play(); else media.pause(); });

  const seekTo = (ratio) => {
    if (isFinite(media.duration)) media.currentTime = Math.min(Math.max(ratio, 0), 1) * media.duration;
  };
  track.addEventListener('click', (e) => {
    const r = track.getBoundingClientRect();
    seekTo((e.clientX - r.left) / r.width);
  });
  track.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') media.currentTime = Math.min(media.currentTime + 5, media.duration || 0);
    if (e.key === 'ArrowLeft') media.currentTime = Math.max(media.currentTime - 5, 0);
  });

  muteBtn.addEventListener('click', () => {
    media.muted = !media.muted;
    muteBtn.setAttribute('aria-pressed', String(media.muted));
    muteBtn.setAttribute('aria-label', media.muted ? 'Unmute' : 'Mute');
    muteBtn.querySelector('.icon-sound').hidden = media.muted;
    muteBtn.querySelector('.icon-muted').hidden = !media.muted;
  });

  media.addEventListener('play', () => setPlaying(true));
  media.addEventListener('pause', () => setPlaying(false));
  media.addEventListener('loadedmetadata', () => { time.textContent = fmt(media.duration); });
  media.addEventListener('timeupdate', () => {
    if (media.duration > 0) {
      const pct = (media.currentTime / media.duration) * 100;
      fill.style.width = pct + '%';
      track.setAttribute('aria-valuenow', String(Math.round(pct)));
    }
    time.textContent = fmt(media.paused ? media.duration : media.currentTime);
  });
  media.addEventListener('ended', () => { fill.style.width = '0%'; setPlaying(false); time.textContent = fmt(media.duration); });
})();
