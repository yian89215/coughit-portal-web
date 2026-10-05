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

// Interactive co-creation demos: map each cough contributor to its MIDI notes.
(function () {
  const demos = Array.from(document.querySelectorAll('[data-music-demo]'));
  if (!demos.length) return;

  const coughSource = 'assets/cough.wav';
  const contributorColors = ['#e5303f', '#111111', '#777777'];

  demos.forEach((demo) => {
    const audio = demo.querySelector('[data-demo-audio]');
    const playButton = demo.querySelector('[data-demo-play]');
    const playLabel = demo.querySelector('[data-demo-play-icon]');
    const canvas = demo.querySelector('[data-midi-canvas]');
    const status = demo.querySelector('[data-midi-status]');
    const progress = demo.querySelector('[data-demo-progress]');
    const coughButtons = Array.from(demo.querySelectorAll('[data-cough]'));
    const ctx = canvas.getContext('2d');
    let midi = null;
    let selected = null;
    let animationFrame = 0;

    const allNotes = () => midi.tracks.flatMap((track, trackIndex) =>
      track.notes.map((note) => ({ ...note, trackIndex }))
    );

    const draw = () => {
      if (!midi) return;
      const rect = canvas.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * scale));
      const height = Math.max(1, Math.round(rect.height * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const w = rect.width;
      const h = rect.height;
      const pad = 14;
      const notes = allNotes();
      const duration = midi.duration_sec || audio.duration || 1;
      const pitches = notes.map((note) => note.pitch);
      const minPitch = Math.min(...pitches);
      const maxPitch = Math.max(...pitches);
      const rows = Math.max(maxPitch - minPitch + 1, demo.dataset.kind === 'drum' ? 16 : 28);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f7f7f5';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#dededb';
      ctx.lineWidth = 1;
      for (let beat = 0; beat <= duration; beat += 2) {
        const x = pad + (beat / duration) * (w - pad * 2);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      notes.forEach((note) => {
        const contributor = note.contributor_cough_index;
        const x = pad + (note.start / duration) * (w - pad * 2);
        const noteWidth = Math.max(2, ((note.end - note.start) / duration) * (w - pad * 2));
        const pitchRow = demo.dataset.kind === 'drum' ? note.pitch - minPitch : maxPitch - note.pitch;
        const trackOffset = demo.dataset.kind === 'trio' ? note.trackIndex * 2 : 0;
        const y = 8 + ((pitchRow + trackOffset) / (rows + (midi.tracks.length - 1) * 2)) * (h - 18);
        const noteHeight = demo.dataset.kind === 'drum' ? 3.5 : 4.5;
        const isContribution = contributor === 0 || contributor === 1 || contributor === 2;
        ctx.globalAlpha = selected === null || contributor === selected ? 0.92 : 0.14;
        ctx.fillStyle = isContribution ? contributorColors[contributor] : '#c9c9c5';
        ctx.fillRect(x, y, noteWidth, noteHeight);
      });
      ctx.globalAlpha = 1;

      if (audio.duration && audio.currentTime > 0) {
        const cursorX = pad + (audio.currentTime / audio.duration) * (w - pad * 2);
        ctx.strokeStyle = '#e5303f';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cursorX, 0);
        ctx.lineTo(cursorX, h);
        ctx.stroke();
      }
    };

    const updatePlayback = () => {
      const ratio = audio.duration ? audio.currentTime / audio.duration : 0;
      progress.style.width = (ratio * 100) + '%';
      draw();
      if (!audio.paused) animationFrame = requestAnimationFrame(updatePlayback);
    };

    fetch(demo.dataset.midi)
      .then((response) => {
        if (!response.ok) throw new Error('MIDI data unavailable');
        return response.json();
      })
      .then((data) => {
        midi = data;
        status.hidden = true;
        draw();
      })
      .catch(() => { status.textContent = 'MIDI visualization unavailable'; });

    playButton.addEventListener('click', () => {
      demos.forEach((other) => {
        if (other !== demo) other.querySelector('[data-demo-audio]').pause();
      });
      if (audio.paused) audio.play(); else audio.pause();
    });

    audio.addEventListener('play', () => {
      playLabel.textContent = 'Pause';
      playButton.setAttribute('aria-label', 'Pause ' + demo.querySelector('h3').textContent);
      cancelAnimationFrame(animationFrame);
      updatePlayback();
    });
    audio.addEventListener('pause', () => {
      playLabel.textContent = 'Play';
      playButton.setAttribute('aria-label', 'Play ' + demo.querySelector('h3').textContent);
      cancelAnimationFrame(animationFrame);
      draw();
    });
    audio.addEventListener('ended', () => {
      audio.currentTime = 0;
      progress.style.width = '0%';
      draw();
    });

    coughButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        selected = selected === index ? null : index;
        coughButtons.forEach((item, itemIndex) => {
          const active = selected === itemIndex;
          item.classList.toggle('is-active', active);
          item.setAttribute('aria-pressed', String(active));
        });
        const cough = new Audio(coughSource);
        cough.playbackRate = [0.94, 1, 1.06][index];
        cough.volume = 0.82;
        cough.play();
        draw();
      });
    });

    canvas.addEventListener('click', (event) => {
      if (!audio.duration) return;
      const rect = canvas.getBoundingClientRect();
      audio.currentTime = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * audio.duration;
      draw();
    });

    new ResizeObserver(draw).observe(canvas);
  });
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
