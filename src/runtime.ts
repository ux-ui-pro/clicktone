export const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

export const noop = (): void => {};

export const clampVolume = (value: number): number => {
  if (!Number.isFinite(value) || value < 0) return 0;

  return value > 1 ? 1 : value;
};
