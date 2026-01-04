const TEMPO_MIN = 30;
const TEMPO_MAX = 240;
const STORAGE_KEY = 'metronome-settings-v1';
const AudioContextClass = window.AudioContext || window.webkitAudioContext;

const state = {
  bpm: 100,
  beatsPerMeasure: 4,
  subdivision: 1,
  gainLevel: 0.75,
  isPlaying: false,
  currentBeat: 0,
  currentSubdivision: 0,
  nextNoteTime: 0,
  lookahead: 25,
  scheduleAheadTime: 0.1,
  scheduler: null,
  tapTimes: [],
  audioCtx: null,
};

const bpmLabel = document.querySelector('#bpm-label');
const tempoSlider = document.querySelector('#tempo-slider');
const tempoInput = document.querySelector('#tempo-input');
const beatIndicators = document.querySelector('#beat-indicators');
const beatsSelect = document.querySelector('#beats-select');
const subdivisionSelect = document.querySelector('#subdivision-select');
const startStop = document.querySelector('#start-stop');
const tapTempo = document.querySelector('#tap-tempo');
const volume = document.querySelector('#volume');
const stepButtons = document.querySelectorAll('[data-change]');

function clampTempo(value) {
  return Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, Math.round(value)));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (typeof saved.bpm === 'number') state.bpm = clampTempo(saved.bpm);
    if (typeof saved.beatsPerMeasure === 'number')
      state.beatsPerMeasure = saved.beatsPerMeasure;
    if (typeof saved.subdivision === 'number')
      state.subdivision = saved.subdivision;
    if (typeof saved.gainLevel === 'number') state.gainLevel = saved.gainLevel;
  } catch (error) {
    console.error('Unable to load saved settings', error);
  }
}

function persistSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        bpm: state.bpm,
        beatsPerMeasure: state.beatsPerMeasure,
        subdivision: state.subdivision,
        gainLevel: state.gainLevel,
      })
    );
  } catch (error) {
    console.error('Unable to save settings', error);
  }
}

function updateTempo(newBpm) {
  state.bpm = clampTempo(newBpm);
  bpmLabel.textContent = state.bpm;
  tempoSlider.value = state.bpm.toString();
  tempoInput.value = state.bpm.toString();
  persistSettings();
}

function updateBeatsPerMeasure(value) {
  state.beatsPerMeasure = value;
  renderBeats();
  persistSettings();
}

function updateSubdivision(value) {
  state.subdivision = value;
  state.currentSubdivision = 0;
  persistSettings();
}

function updateVolume(value) {
  state.gainLevel = Math.max(0, Math.min(1, Number(value)));
  persistSettings();
}

function renderBeats() {
  beatIndicators.innerHTML = '';
  for (let i = 0; i < state.beatsPerMeasure; i += 1) {
    const beat = document.createElement('div');
    beat.className = 'beat';
    if (i === 0) {
      beat.classList.add('accent');
    }
    beat.textContent = i + 1;
    beatIndicators.appendChild(beat);
  }
}

function highlightBeat(position) {
  const beats = Array.from(beatIndicators.querySelectorAll('.beat'));
  beats.forEach((node, idx) => {
    const isActive = idx === position - 1;
    node.classList.toggle('active', isActive);
  });
}

function createAudioContext() {
  if (!AudioContextClass) {
    alert('Web Audio is not supported in this browser.');
    return null;
  }
  if (!state.audioCtx) {
    state.audioCtx = new AudioContextClass();
  }
  return state.audioCtx;
}

function scheduleClick(beatNumber, time, type = 'beat') {
  const ctx = createAudioContext();
  if (!ctx) return;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  let frequency = 940;
  let gainMultiplier = 0.7;

  if (type === 'beat') {
    if (beatNumber === 1) {
      frequency = 1280;
      gainMultiplier = 0.9;
    }
  } else if (type === 'subdivision') {
    frequency = 800;
    gainMultiplier = 0.2;
  }

  const baseGain = Math.max(0.0001, state.gainLevel * gainMultiplier);

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(baseGain, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);

  oscillator.frequency.setValueAtTime(frequency, time);
  oscillator.type = 'square';
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.12);

  if (type === 'beat') {
    const msUntilBeat = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => highlightBeat(beatNumber), msUntilBeat);
  }
}

function scheduler() {
  if (!state.audioCtx) return;
  const secondsPerBeat = 60.0 / state.bpm;
  const secondsPerSubdivision = secondsPerBeat / state.subdivision;

  while (
    state.nextNoteTime <
    state.audioCtx.currentTime + state.scheduleAheadTime
  ) {
    if (state.currentSubdivision === 0) {
      state.currentBeat = (state.currentBeat % state.beatsPerMeasure) + 1;
      scheduleClick(state.currentBeat, state.nextNoteTime, 'beat');
    } else {
      scheduleClick(state.currentBeat, state.nextNoteTime, 'subdivision');
    }

    state.currentSubdivision++;
    if (state.currentSubdivision >= state.subdivision) {
      state.currentSubdivision = 0;
    }

    state.nextNoteTime += secondsPerSubdivision;
  }
}

async function startMetronome() {
  if (state.isPlaying) return;
  const ctx = createAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  state.isPlaying = true;
  state.currentBeat = 0;
  state.currentSubdivision = 0;
  state.nextNoteTime = ctx.currentTime + 0.05;
  startStop.textContent = 'Stop';
  startStop.classList.add('primary');
  highlightBeat(0);

  state.scheduler = setInterval(scheduler, state.lookahead);
}

function stopMetronome() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  startStop.textContent = 'Start';
  startStop.classList.remove('primary');
  clearInterval(state.scheduler);
  state.scheduler = null;
  highlightBeat(0);
}

function handleTapTempo() {
  const now = performance.now();
  const recent = state.tapTimes.filter((time) => now - time < 3000);
  recent.push(now);
  state.tapTimes = recent;
  if (recent.length < 2) return;
  const intervals = [];
  for (let i = 1; i < recent.length; i += 1) {
    intervals.push(recent[i] - recent[i - 1]);
  }
  const avgMs = intervals.reduce((acc, val) => acc + val, 0) / intervals.length;
  const bpm = clampTempo(60000 / avgMs);
  updateTempo(bpm);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('Service worker registration failed', error);
    });
  });
}

function bindEvents() {
  tempoSlider.addEventListener('input', (event) => {
    updateTempo(Number(event.target.value));
  });

  tempoInput.addEventListener('input', (event) => {
    const value = Number(event.target.value);
    if (!Number.isNaN(value)) {
      updateTempo(value);
    }
  });

  stepButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.change);
      updateTempo(state.bpm + delta);
    });
  });

  beatsSelect.addEventListener('change', (event) => {
    updateBeatsPerMeasure(Number(event.target.value));
  });

  subdivisionSelect.addEventListener('change', (event) => {
    updateSubdivision(Number(event.target.value));
  });

  volume.addEventListener('input', (event) => {
    updateVolume(Number(event.target.value));
  });

  startStop.addEventListener('click', () => {
    if (state.isPlaying) {
      stopMetronome();
    } else {
      startMetronome();
    }
  });

  tapTempo.addEventListener('click', async () => {
    const ctx = createAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    handleTapTempo();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.isPlaying) {
      stopMetronome();
    }
  });
}

function init() {
  loadSettings();
  updateTempo(state.bpm);
  beatsSelect.value = String(state.beatsPerMeasure);
  subdivisionSelect.value = String(state.subdivision);
  volume.value = state.gainLevel.toString();
  renderBeats();
  bindEvents();
  registerServiceWorker();
}

init();

export {
  state,
  updateTempo,
  updateBeatsPerMeasure,
  updateSubdivision,
  scheduler,
  scheduleClick,
  startMetronome,
  stopMetronome,
  clampTempo
};
