// ---------------------------------------------------------------------------
// storage.js — localStorage with graceful failure (private mode, sandboxed
// iframes and disabled storage all throw; the game must never crash on it).
// ---------------------------------------------------------------------------

import { STORAGE_KEYS } from './config.js';

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* storage unavailable — progress simply isn't remembered */
  }
}

function readNumber(key) {
  const value = Number(read(key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export const storage = {
  isMuted: () => read(STORAGE_KEYS.muted) === '1',
  setMuted: (muted) => write(STORAGE_KEYS.muted, muted ? '1' : '0'),
  bestTime: () => readNumber(STORAGE_KEYS.bestTime),
  mostPhotos: () => readNumber(STORAGE_KEYS.mostPhotos) || 0,

  /** Record a finished (or failed) run. Returns which records were beaten. */
  recordRun({ photos, time, won }) {
    const result = { newBestTime: false, newMostPhotos: false };
    if (photos > storage.mostPhotos()) {
      write(STORAGE_KEYS.mostPhotos, photos);
      result.newMostPhotos = true;
    }
    const best = storage.bestTime();
    if (won && (best === null || time < best)) {
      write(STORAGE_KEYS.bestTime, time.toFixed(2));
      result.newBestTime = true;
    }
    return result;
  },
};
