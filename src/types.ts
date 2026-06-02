declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

export interface SoundDescriptor {
  src: string;
  type?: string;
}

export type SoundSource =
  | string
  | URL
  | SoundDescriptor
  | { id: string }
  | HTMLSourceElement
  | HTMLAudioElement;

export type SoundInput = SoundSource | SoundSource[];

export interface ClickToneOptions {
  src: SoundInput;
  volume?: number;
  muted?: boolean;
  throttle?: number;
  pitchVariation?: number;
  preload?: boolean;
  debug?: boolean;
}

export interface ClickToneEventDetail {
  play: undefined;
  end: undefined;
  unlock: undefined;
  load: AudioBuffer;
  error: Error;
}

export type ClickToneEventType = keyof ClickToneEventDetail;
