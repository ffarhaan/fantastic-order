/**
 * Crisp Enterprise Chime Synthesizer via Web Audio API
 * Dual-tone cheerful chime (D5: 587.33Hz -> A5: 880Hz) with crystal clarity
 * Inspired by modern notification sounds (Apple / Slack / Linear).
 * Zero external audio files required, zero latency, 100% offline.
 */

const STORAGE_KEY = "ret_sound_enabled";

export function isShipmentSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setShipmentSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
  } catch {}
}

export function playShipmentChime(force: boolean = false): void {
  if (typeof window === "undefined") return;
  if (!force && !isShipmentSoundEnabled()) return;

  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Helper to synthesize a crystalline sinusoidal bell note
    const playTone = (
      freq: number,
      startTime: number,
      duration: number,
      peakGain: number
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      // Fast, smooth attack & gentle exponential decay (no clicks/pops)
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.05);
    };

    // Note 1: D5 (587.33 Hz) - Crisp cheerful ping
    playTone(587.33, now, 0.2, 0.22);
    // Note 1 subtle overtone for bell shimmer (1174.66 Hz)
    playTone(1174.66, now, 0.14, 0.04);

    // Note 2: A5 (880.00 Hz) - Bright, elegant resolving tone (110ms later)
    playTone(880.0, now + 0.11, 0.42, 0.28);
    // Note 2 subtle overtone for glassy clarity (1760.00 Hz)
    playTone(1760.0, now + 0.11, 0.28, 0.05);

    // Dispose audio context when chime finishes
    setTimeout(() => {
      try {
        ctx.close().catch(() => {});
      } catch {}
    }, 800);
  } catch (err) {
    console.warn("playShipmentChime error:", err);
  }
}
