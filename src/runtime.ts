export const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

export const noop = (): void => {};

/**
 * iOS Safari (and desktop Safari) can leave an AudioContext in a "zombie"
 * state after a tab switch / lock-screen return: `state === 'running'` yet no
 * audio is produced. The only deterministic fix is recreating the context, but
 * that cost is pointless on engines without the bug (e.g. desktop Chrome), so
 * we gate the hard-recovery path behind this detection.
 */
export const isAppleWebAudioFlaky = (): boolean => {
  if (!hasDOM) return false;

  const ua = navigator.userAgent;
  const iOS =
    /iP(hone|ad|od)/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);

  return iOS || safari;
};

export const clampVolume = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0;

  return value > 1 ? 1 : value;
};
