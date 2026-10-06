// Interactive co-creation demos: cough → generated music → final composition.
(function () {
  const demos = Array.from(document.querySelectorAll('[data-music-demo]'));
  if (!demos.length) return;

  let activeAudio = null;
  let activeButton = null;
  let activeFrame = 0;
  let activeOnStop = null;
  let waveformContext = null;

  const setButtonPlaying = (button, playing) => {
    if (!button) return;
    button.classList.toggle('is-playing', playing);
    button.setAttribute('aria-pressed', String(playing));
    const icon = button.querySelector('[data-play-icon]');
    if (icon) icon.textContent = playing ? '❚❚' : '▶';
  };

  const stopActive = (completed = false) => {
    cancelAnimationFrame(activeFrame);
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    }
    if (activeButton) setButtonPlaying(activeButton, false);
    const onStop = activeOnStop;
    activeAudio = null;
    activeButton = null;
    activeOnStop = null;
    if (onStop) onStop(completed);
  };

  const notesFrom = (midi) => midi.tracks.flatMap((track, trackIndex) =>
    track.notes.map((note) => ({ ...note, trackIndex }))
  );

  const drawRoll = (canvas, midi, currentTime = 0, playbackDuration = 0) => {
    if (!midi) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const pad = 10;
    const notes = notesFrom(midi);
    const duration = midi.duration_sec || playbackDuration || 1;
    const pitches = notes.map((note) => note.pitch);
    const minPitch = Math.min(...pitches);
    const maxPitch = Math.max(...pitches);
    const mergeTracks = canvas.hasAttribute('data-midi-canvas');
    const rows = Math.max(maxPitch - minPitch + 1, midi.type === 'drum' ? 10 : 14);

    ctx.fillStyle = '#f7f7f5';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e7e6ff';
    ctx.lineWidth = 1;
    for (let second = 0; second <= duration; second += Math.max(1, Math.round(duration / 8))) {
      const x = pad + (second / duration) * (w - pad * 2);
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    notes.forEach((note) => {
      const x = pad + (note.start / duration) * (w - pad * 2);
      const noteWidth = Math.max(2, ((note.end - note.start) / duration) * (w - pad * 2));
      const row = midi.type === 'drum' ? note.pitch - minPitch : maxPitch - note.pitch + (mergeTracks ? 0 : note.trackIndex * 2);
      const totalRows = rows + (mergeTracks ? 0 : Math.max(0, midi.tracks.length - 1) * 2);
      const y = 6 + (row / totalRows) * (h - 14);
      ctx.fillStyle = '#646464';
      ctx.fillRect(x, y, noteWidth, midi.type === 'drum' ? 3 : 4);
      if (currentTime > note.start) {
        const playedEnd = Math.min(note.end, currentTime);
        const playedWidth = Math.max(0, ((playedEnd - note.start) / duration) * (w - pad * 2));
        ctx.fillStyle = '#111111';
        ctx.fillRect(x, y, playedWidth, midi.type === 'drum' ? 3 : 4);
      }
    });

    if (currentTime > 0 && playbackDuration > 0) {
      const cursorX = pad + Math.min(1, currentTime / playbackDuration) * (w - pad * 2);
      ctx.strokeStyle = '#1d154a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cursorX, 0); ctx.lineTo(cursorX, h); ctx.stroke();
    }
  };

  const drawWaveform = (canvas, buffer, progress = 0) => {
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * scale));
    canvas.height = Math.max(1, Math.round(rect.height * scale));
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const data = buffer.getChannelData(0);
    const samplesPerPixel = Math.max(1, Math.floor(data.length / Math.max(1, w)));

    ctx.fillStyle = '#f7f7f5';
    ctx.fillRect(0, 0, w, h);
    const paintWave = (color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 1) {
        const start = Math.floor(x * samplesPerPixel);
        const end = Math.min(data.length, start + samplesPerPixel);
        let min = 1;
        let max = -1;
        for (let i = start; i < end; i += 1) {
          min = Math.min(min, data[i]);
          max = Math.max(max, data[i]);
        }
        ctx.moveTo(x + 0.5, (1 + min) * h / 2);
        ctx.lineTo(x + 0.5, (1 + max) * h / 2);
      }
      ctx.stroke();
    };

    paintWave('#c8c8c8');
    if (progress > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, Math.min(1, progress) * w, h);
      ctx.clip();
      paintWave('#111111');
      ctx.restore();
    }
  };

  const play = (audio, button, onFrame, onEnd) => {
    if (activeAudio === audio && !audio.paused) { stopActive(); return; }
    stopActive();
    activeAudio = audio;
    activeButton = button;
    activeOnStop = onEnd;
    setButtonPlaying(button, true);
    audio.play().catch(() => stopActive(false));
    const tick = () => {
      onFrame();
      if (!audio.paused) activeFrame = requestAnimationFrame(tick);
    };
    tick();
    audio.onended = () => stopActive(true);
  };

  demos.forEach((demo) => {
    const finalAudio = demo.querySelector('[data-demo-audio]');
    const finalButton = demo.querySelector('[data-demo-play]');
    const finalLabel = demo.querySelector('[data-demo-play-icon]');
    const finalCanvas = demo.querySelector('[data-midi-canvas]');
    const status = demo.querySelector('[data-midi-status]');
    const progress = demo.querySelector('[data-demo-progress]');
    let finalMidi = null;

    fetch(demo.dataset.finalMidi).then((response) => response.json()).then((data) => {
      finalMidi = data;
      status.hidden = true;
      drawRoll(finalCanvas, finalMidi);
    }).catch(() => { status.textContent = 'MIDI visualization unavailable'; });

    finalButton.addEventListener('click', () => {
      const name = demo.querySelector('h3').textContent;
      play(finalAudio, finalButton, () => {
        finalLabel.textContent = '❚❚ Pause ' + name;
        progress.style.width = ((finalAudio.currentTime / finalAudio.duration) * 100 || 0) + '%';
        drawRoll(finalCanvas, finalMidi, finalAudio.currentTime, finalAudio.duration);
      }, (completed) => {
        finalLabel.textContent = '▶ Play ' + name;
        progress.style.width = completed ? '100%' : '0%';
        drawRoll(finalCanvas, finalMidi, completed ? finalAudio.duration : 0, finalAudio.duration);
      });
    });

    finalCanvas.addEventListener('click', (event) => {
      if (!finalAudio.duration) return;
      const rect = finalCanvas.getBoundingClientRect();
      finalAudio.currentTime = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * finalAudio.duration;
      drawRoll(finalCanvas, finalMidi, finalAudio.currentTime, finalAudio.duration);
    });

    demo.querySelectorAll('[data-contribution]').forEach((contribution) => {
      const canvas = contribution.querySelector('[data-motif-canvas]');
      const waveform = contribution.querySelector('[data-waveform]');
      const coughButton = contribution.querySelector('[data-sample="cough"]');
      const motifButton = contribution.querySelector('[data-sample="motif"]');
      const coughAudio = new Audio(contribution.dataset.coughAudio);
      const motifAudio = new Audio(contribution.dataset.motifAudio);
      let motifMidi = null;
      let coughBuffer = null;
      const syncStart = Number(contribution.dataset.syncStart || 0);

      fetch(contribution.dataset.motifMidi).then((response) => response.json()).then((data) => {
        motifMidi = data;
        drawRoll(canvas, motifMidi);
      });

      fetch(contribution.dataset.coughAudio)
        .then((response) => response.arrayBuffer())
        .then((arrayBuffer) => {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (!AudioContextClass) return null;
          waveformContext = waveformContext || new AudioContextClass();
          return waveformContext.decodeAudioData(arrayBuffer);
        })
        .then((buffer) => {
          coughBuffer = buffer;
          drawWaveform(waveform, coughBuffer);
        })
        .catch(() => {});

      coughButton.addEventListener('click', () => {
        play(coughAudio, coughButton, () => {
          drawWaveform(waveform, coughBuffer, coughAudio.currentTime / coughAudio.duration);
        }, (completed) => drawWaveform(waveform, coughBuffer, completed ? 1 : 0));
      });
      motifButton.addEventListener('click', () => {
        play(motifAudio, motifButton, () => {
          const midiDuration = (motifMidi && motifMidi.duration_sec) || motifAudio.duration || 1;
          const midiTime = Math.max(0, Math.min(midiDuration, motifAudio.currentTime - syncStart));
          drawRoll(canvas, motifMidi, midiTime, midiDuration);
        }, (completed) => {
          const midiDuration = (motifMidi && motifMidi.duration_sec) || motifAudio.duration || 1;
          drawRoll(canvas, motifMidi, completed ? midiDuration : 0, midiDuration);
        });
      });

      new ResizeObserver(() => {
        drawRoll(canvas, motifMidi);
        drawWaveform(waveform, coughBuffer);
      }).observe(contribution);
    });

    new ResizeObserver(() => drawRoll(finalCanvas, finalMidi, finalAudio.currentTime, finalAudio.duration)).observe(finalCanvas);
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
