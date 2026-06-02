import { engine } from './engine/SharedAudioEngine';
import { clampVolume, noop } from './runtime';
import { resolveBestSource } from './source';
import type {
  ClickToneEventDetail,
  ClickToneEventType,
  ClickToneOptions,
  SoundInput,
} from './types';

export class ClickTone extends EventTarget {
  #url: string | null = null;
  #initError: Error | null = null;
  #volume: number;
  #muted: boolean;
  #throttle: number;
  #pitch: number;
  #debug: boolean;
  #lastPlay = 0;
  #gain: GainNode | null = null;
  #destroyed = false;

  constructor({
    src,
    volume = 1,
    muted = false,
    throttle = 0,
    pitchVariation = 0,
    preload = false,
    debug = false,
  }: ClickToneOptions) {
    super();

    this.#volume = clampVolume(volume);
    this.#muted = muted;
    this.#throttle = Math.max(0, throttle);
    this.#pitch = Math.min(1, Math.max(0, pitchVariation));
    this.#debug = debug;

    try {
      this.#url = resolveBestSource(src);
    } catch (error) {
      this.#initError = error as Error;
    }

    engine.prime();
    engine.onUnlock(() => this.#emit('unlock'));

    if (preload) void this.preload();
  }

  static unlock(): void {
    engine.prime();
    engine.unlock();
  }

  static get unlocked(): boolean {
    return engine.unlocked;
  }

  get volume(): number {
    return this.#volume;
  }

  get muted(): boolean {
    return this.#muted;
  }

  async preload(): Promise<AudioBuffer | undefined> {
    if (this.#destroyed || !this.#url) return undefined;

    try {
      const buffer = await engine.decode(this.#url);

      this.#emit('load', buffer);

      return buffer;
    } catch (error) {
      this.#fail(error as Error);

      return undefined;
    }
  }

  unlock(): void {
    engine.unlock();
  }

  setVolume(value: number): void {
    this.#volume = clampVolume(value);

    if (this.#gain && !this.#muted) this.#rampGain(this.#volume);
  }

  setMuted(muted: boolean): void {
    this.#muted = muted;

    if (this.#gain) this.#rampGain(muted ? 0 : this.#volume);
    if (!muted) engine.unlock();
  }

  toggleMuted(): boolean {
    this.setMuted(!this.#muted);

    return this.#muted;
  }

  async play(src?: SoundInput): Promise<void> {
    if (this.#destroyed) return;

    const now = Date.now();

    if (now - this.#lastPlay < this.#throttle) return;

    this.#lastPlay = now;

    engine.unlock();

    let url: string;

    try {
      url = src ? resolveBestSource(src) : this.#requireUrl();
    } catch (error) {
      this.#fail(error as Error);

      return;
    }

    try {
      const buffer = await engine.decode(url);
      const ctx = engine.context();

      if (!ctx || this.#destroyed) return;

      if (ctx.state !== 'running') await ctx.resume().catch(noop);

      const gain = this.#ensureGain(ctx);
      const source = ctx.createBufferSource();

      source.buffer = buffer;

      if (this.#pitch > 0) {
        source.playbackRate.value = Math.max(0.5, 1 + (Math.random() * 2 - 1) * this.#pitch);
      }

      source.connect(gain);
      this.#emit('play');

      await new Promise<void>((resolve) => {
        source.onended = (): void => {
          source.disconnect();
          resolve();
        };

        source.start(0);
      });

      this.#emit('end');
    } catch (error) {
      this.#fail(error as Error);
    }
  }

  on<T extends ClickToneEventType>(
    type: T,
    listener: (detail: ClickToneEventDetail[T]) => void,
  ): () => void {
    const handler = (event: Event): void =>
      listener((event as CustomEvent<ClickToneEventDetail[T]>).detail);

    this.addEventListener(type, handler as EventListener);

    return () => this.removeEventListener(type, handler as EventListener);
  }

  once<T extends ClickToneEventType>(
    type: T,
    listener: (detail: ClickToneEventDetail[T]) => void,
  ): void {
    const handler = (event: Event): void =>
      listener((event as CustomEvent<ClickToneEventDetail[T]>).detail);

    this.addEventListener(type, handler as EventListener, { once: true });
  }

  destroy(): void {
    if (this.#destroyed) return;

    this.#destroyed = true;
    this.#gain?.disconnect();
    this.#gain = null;
  }

  #requireUrl(): string {
    if (this.#url) return this.#url;

    throw this.#initError ?? new Error('No valid sound source.');
  }

  #ensureGain(ctx: AudioContext): GainNode {
    if (!this.#gain || this.#gain.context !== ctx) {
      this.#gain = ctx.createGain();
      this.#gain.gain.value = this.#muted ? 0 : this.#volume;
      this.#gain.connect(ctx.destination);
    }

    return this.#gain;
  }

  #rampGain(target: number): void {
    const gain = this.#gain;

    if (!gain) return;

    const now = gain.context.currentTime;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(target, now + 0.015);
  }

  #emit<T extends ClickToneEventType>(type: T, detail?: ClickToneEventDetail[T]): void {
    if (typeof CustomEvent !== 'undefined') {
      this.dispatchEvent(new CustomEvent(type, { detail }));
    } else if (typeof Event !== 'undefined') {
      const event = new Event(type) as Event & { detail?: unknown };

      event.detail = detail;
      this.dispatchEvent(event);
    }
  }

  #fail(error: Error): void {
    if (this.#debug) console.error('[ClickTone]', error);

    this.#emit('error', error);
  }
}
