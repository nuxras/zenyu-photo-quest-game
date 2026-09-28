// ---------------------------------------------------------------------------
// audio.js — every sound is synthesised with the Web Audio API (no files).
// The AudioContext is only created after the first key press / tap, as
// browsers require. Mute state persists in localStorage.
// ---------------------------------------------------------------------------

import { storage } from './storage.js';

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Ambient progression: warm, slightly wistful golden-hour chords.
const CHORDS = [
  { bass: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { bass: 40, notes: [52, 55, 59, 62] }, // Em7
  { bass: 38, notes: [50, 53, 57, 60] }, // Dm7
  { bass: 36, notes: [48, 52, 55, 59] }, // Cmaj7
];
const MELODY = [72, 74, 76, 79, 81, 84]; // C major pentatonic
const BEAT = 60 / 76; // 76 BPM, lazy lo-fi tempo

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let noiseBuffer = null;
  let muted = storage.isMuted();
  let schedulerId = 0;
  let nextBeatTime = 0;
  let beatIndex = 0;

  function now() {
    return ctx.currentTime;
  }

  /** Create the context on the first user gesture (autoplay policy). */
  function unlock() {
    if (!ctx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      ctx = new AudioContextClass();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 1;
      sfxBus.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.55;
      const warmth = ctx.createBiquadFilter();
      warmth.type = 'lowpass';
      warmth.frequency.value = 2200;
      musicBus.connect(warmth);
      warmth.connect(master);
      noiseBuffer = makeNoiseBuffer();
      startAmbient();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function makeNoiseBuffer() {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // --- Building blocks ---------------------------------------------------------------

  /** One oscillator note with a quick attack and exponential decay. */
  function tone({ freq, to = freq, dur = 0.1, type = 'square', vol = 0.1, at = 0, bus = sfxBus, attack = 0.005 }) {
    const t0 = now() + at;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  /** Filtered white noise burst (clicks, thuds, steam). */
  function noise({ dur = 0.1, vol = 0.1, filter = 'bandpass', freq = 1000, q = 1, at = 0, attack = 0.002, bus = sfxBus }) {
    const t0 = now() + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const biquad = ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.value = freq;
    biquad.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(biquad);
    biquad.connect(gain);
    gain.connect(bus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  // --- Sound effects --------------------------------------------------------------------
  const SOUNDS = {
    jump: () => tone({ freq: 360, to: 660, dur: 0.1, vol: 0.06 }),
    land: () => {
      noise({ dur: 0.07, vol: 0.12, filter: 'lowpass', freq: 500 });
      tone({ freq: 110, to: 60, dur: 0.07, type: 'sine', vol: 0.12 });
    },
    step: () => noise({ dur: 0.025, vol: 0.018, filter: 'highpass', freq: 2600 }),
    raise: () => tone({ freq: 520, to: 780, dur: 0.06, type: 'triangle', vol: 0.05 }),
    shutter: () => {
      // "ka-chik": mirror slap, then the shutter curtain, then a film wind.
      noise({ dur: 0.035, vol: 0.3, freq: 3200, q: 0.8 });
      noise({ dur: 0.05, vol: 0.22, freq: 1800, q: 1.2, at: 0.065 });
      tone({ freq: 1900, to: 900, dur: 0.12, type: 'sine', vol: 0.03, at: 0.02 });
      noise({ dur: 0.18, vol: 0.04, filter: 'highpass', freq: 5000, at: 0.14, attack: 0.03 });
    },
    click: () => {
      noise({ dur: 0.03, vol: 0.14, freq: 2400, q: 1 });
      noise({ dur: 0.03, vol: 0.08, freq: 1500, q: 1, at: 0.05 });
    },
    collect: () => {
      tone({ freq: 880, dur: 0.1, type: 'triangle', vol: 0.08 });
      tone({ freq: 1320, dur: 0.16, type: 'triangle', vol: 0.08, at: 0.07 });
      tone({ freq: 1760, dur: 0.2, type: 'sine', vol: 0.03, at: 0.12 });
    },
    hurt: () => {
      tone({ freq: 320, to: 110, dur: 0.22, vol: 0.09 });
      noise({ dur: 0.12, vol: 0.1, filter: 'lowpass', freq: 900 });
    },
    gameOver: () => {
      [440, 370, 311, 262].forEach((f, i) =>
        tone({ freq: f, dur: 0.22, type: 'triangle', vol: 0.09, at: 0.25 + i * 0.2 }),
      );
    },
    win: () => {
      [72, 76, 79, 84].forEach((n, i) => tone({ freq: midi(n), dur: 0.14, type: 'square', vol: 0.045, at: i * 0.1 }));
      [72, 76, 79].forEach((n) => tone({ freq: midi(n), dur: 0.9, type: 'triangle', vol: 0.06, at: 0.42, attack: 0.02 }));
      tone({ freq: midi(88), dur: 0.6, type: 'sine', vol: 0.03, at: 0.5 });
    },
    coo: () => {
      tone({ freq: 330, to: 270, dur: 0.16, type: 'sine', vol: 0.04 });
      tone({ freq: 300, to: 250, dur: 0.2, type: 'sine', vol: 0.035, at: 0.2 });
    },
    flap: () => {
      for (let i = 0; i < 3; i++) noise({ dur: 0.04, vol: 0.08, freq: 1100, q: 0.7, at: i * 0.06 });
    },
    barrel: () => {
      noise({ dur: 0.12, vol: 0.1, filter: 'lowpass', freq: 260 });
      tone({ freq: 90, to: 70, dur: 0.12, type: 'sine', vol: 0.08 });
    },
    thud: () => tone({ freq: 120, to: 55, dur: 0.09, type: 'sine', vol: 0.1 }),
    hiss: () => noise({ dur: 0.7, vol: 0.025, filter: 'highpass', freq: 4200, attack: 0.5 }),
    steam: () => noise({ dur: 0.9, vol: 0.07, freq: 2600, q: 0.6, attack: 0.03 }),
    menuMove: () => tone({ freq: 660, dur: 0.035, vol: 0.035 }),
    menuSelect: () => {
      tone({ freq: 660, dur: 0.05, vol: 0.045 });
      tone({ freq: 990, dur: 0.08, vol: 0.045, at: 0.05 });
    },
    pause: () => tone({ freq: 520, to: 390, dur: 0.09, type: 'triangle', vol: 0.06 }),
    start: () => {
      tone({ freq: 523, dur: 0.08, type: 'triangle', vol: 0.07 });
      tone({ freq: 784, dur: 0.14, type: 'triangle', vol: 0.07, at: 0.08 });
    },
  };

  function play(name) {
    if (!ctx || muted || ctx.state !== 'running') return;
    SOUNDS[name]?.();
  }

  // --- Ambient loop ------------------------------------------------------------------------
  // A tiny look-ahead scheduler: every 150 ms, queue any beats that start in
  // the next 0.5 s. Timing comes from the audio clock, so it never drifts.

  function scheduleBeat(time, index) {
    const bar = Math.floor(index / 4) % CHORDS.length;
    const beat = index % 4;
    const chord = CHORDS[bar];
    const at = time - now();
    if (beat === 0) {
      chord.notes.forEach((n, i) =>
        tone({ freq: midi(n), dur: BEAT * 4.2, type: i % 2 ? 'sine' : 'triangle', vol: 0.022, at, attack: 0.5, bus: musicBus }),
      );
    }
    if (beat === 0 || beat === 2) {
      tone({ freq: midi(chord.bass), dur: BEAT * 1.8, type: 'sine', vol: 0.07, at, attack: 0.02, bus: musicBus });
    }
    // Sparse music-box melody on the off-beats.
    for (const half of [0, 0.5]) {
      if (Math.random() < 0.28) {
        const note = MELODY[Math.floor(Math.random() * MELODY.length)];
        tone({ freq: midi(note), dur: 0.5, type: 'triangle', vol: 0.028, at: at + half * BEAT, bus: musicBus });
      }
    }
    // Soft vinyl crackle bed.
    if (Math.random() < 0.6) {
      noise({ dur: 0.02, vol: 0.012, filter: 'highpass', freq: 3000, at: at + Math.random() * BEAT, bus: musicBus });
    }
  }

  function startAmbient() {
    nextBeatTime = now() + 0.2;
    beatIndex = 0;
    clearInterval(schedulerId);
    schedulerId = setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      // After a throttled background tab, skip missed beats instead of
      // playing them all at once.
      if (nextBeatTime < now() - 0.2) nextBeatTime = now() + 0.05;
      while (nextBeatTime < now() + 0.5) {
        scheduleBeat(nextBeatTime, beatIndex);
        nextBeatTime += BEAT;
        beatIndex++;
      }
    }, 150);
  }

  function setMuted(value) {
    muted = value;
    storage.setMuted(muted);
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, now(), 0.03);
  }

  /** Silence everything while the tab is hidden; resume when it's back. */
  function setSuspended(hidden) {
    if (!ctx) return;
    if (hidden && ctx.state === 'running') ctx.suspend();
    if (!hidden && ctx.state === 'suspended') ctx.resume();
  }

  /** Lower the music (e.g. while paused) without touching sound effects. */
  function duck(on) {
    if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.2 : 0.55, now(), 0.15);
  }

  function destroy() {
    clearInterval(schedulerId);
    ctx?.close();
  }

  return {
    unlock,
    play,
    duck,
    setSuspended,
    setMuted,
    toggleMute: () => setMuted(!muted),
    isMuted: () => muted,
    /** 'locked' until the first gesture, then the AudioContext state. */
    state: () => ctx?.state ?? 'locked',
    destroy,
  };
}
