"use client";

type HapticTone = "light" | "medium" | "heavy";
type UiTone = "tap" | "open" | "close" | "route";

let audioContextRef: AudioContext | null = null;

function resolveAudioContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const Ctor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) {
    return null;
  }

  if (!audioContextRef) {
    audioContextRef = new Ctor();
  }

  return audioContextRef;
}

export function triggerHaptic(tone: HapticTone = "light") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  if (tone === "heavy") {
    navigator.vibrate([16, 12, 18]);
    return;
  }

  if (tone === "medium") {
    navigator.vibrate(14);
    return;
  }

  navigator.vibrate(8);
}

export function playUiTone(tone: UiTone = "tap") {
  const audioContext = resolveAudioContext();
  if (!audioContext) {
    return;
  }

  void audioContext.resume().catch(() => undefined);

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  const now = audioContext.currentTime;

  const profile =
    tone === "route"
      ? { frequency: 540, endFrequency: 620, duration: 0.065, peak: 0.03 }
      : tone === "open"
        ? { frequency: 480, endFrequency: 560, duration: 0.055, peak: 0.025 }
        : tone === "close"
          ? { frequency: 420, endFrequency: 360, duration: 0.05, peak: 0.022 }
          : { frequency: 460, endFrequency: 500, duration: 0.04, peak: 0.018 };

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(profile.frequency, now);
  oscillator.frequency.linearRampToValueAtTime(profile.endFrequency, now + profile.duration);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(profile.peak, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.start(now);
  oscillator.stop(now + profile.duration + 0.01);
}

export function emitUiFeedback(tone: UiTone = "tap", haptic: HapticTone = "light") {
  triggerHaptic(haptic);
  playUiTone(tone);
}
