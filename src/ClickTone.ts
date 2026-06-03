import { engine } from './engine/SharedAudioEngine';
import { clampVolume, noop } from './runtime';
import { resolveBestSource } from './source';
import type {
  ClickToneEventDetail,
  ClickToneEventType,
  ClickToneOptions,
  PlayOptions,
  ReplayBehavior,
  SoundInput,
} from './types';

type ActivePlayback = {
  source: AudioBufferSourceNode;
  url: string;
  loop: boolean;
  stopped: boolean;
};

export class ClickTone extends EventTarget {
  #url: string | null = null;
  #initError: Error | null = null;
  #volume: number;
  #muted: boolean;
  #throttle: number;
  #pitch: number;
  #loop: boolean;
  #replay: ReplayBehavior;
  #debug: boolean;
  #lastPlay = 0;
  #gain: GainNode | null = null;
  #activePlaybacks = new Set<ActivePlayback>();
  #needsGainRefresh = false;
  #visibilityHandler: (() => void) | null = null;
  #recreateUnsubscribe: (() => void) | null = null;
  #destroyed = false;

  constructor({
    src,
    volume = 1,
    muted = false,
    throttle = 0,
    pitchVariation = 0,
    preload = false,
    loop = false,
    replay = 'overlap',
    debug = false,
  }: ClickToneOptions) {
    super();

    this.#volume = clampVolume(volume);
    this.#muted = muted;
    this.#throttle = Math.max(0, throttle);
    this.#pitch = Math.min(1, Math.max(0, pitchVariation));
    this.#loop = loop;
    this.#replay = replay;
    this.#debug = debug;

    try {
      this.#url = resolveBestSource(src);
    } catch (error) {
      this.#initError = error as Error;
    }

    engine.prime();
    engine.onUnlock(() => this.#emit('unlock'));
    this.#recreateUnsubscribe = engine.onRecreate(() => this.#restartActiveLoops());

    if (typeof document !== 'undefined') {
      this.#visibilityHandler = (): void => {
        if (!document.hidden) this.#needsGainRefresh = true;
      };
      document.addEventListener('visibilitychange', this.#visibilityHandler);
    }

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

  get playing(): boolean {
    return this.#activePlaybacks.size > 0;
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

  async play(input?: SoundInput | PlayOptions): Promise<void> {
    await this.#play(this.#normalizePlayOptions(input));
  }

  stop(): void {
    this.#stopActivePlaybacks(true);
  }

  async #play(
    { src, loop = this.#loop, replay = this.#replay }: PlayOptions,
    { skipThrottle = false }: { skipThrottle?: boolean } = {},
  ): Promise<void> {
    if (this.#destroyed) return;

    if (this.playing && replay === 'ignore-if-playing') return;

    const now = Date.now();

    if (!skipThrottle && replay !== 'restart' && now - this.#lastPlay < this.#throttle) return;

    if (this.playing && (replay === 'interrupt' || replay === 'restart')) {
      this.#stopActivePlaybacks(true);
    }

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
      const ctx = await engine.ensureRunning();

      if (!ctx || this.#destroyed) return;
      if (ctx.state !== 'running') throw new Error('AudioContext is not running.');

      const buffer = await engine.decode(url);

      if (ctx.state !== 'running') await ctx.resume().catch(noop);

      const gain = this.#ensureGain(ctx);
      const source = ctx.createBufferSource();

      source.buffer = buffer;
      source.loop = loop;

      if (this.#pitch > 0) {
        source.playbackRate.value = Math.max(0.5, 1 + (Math.random() * 2 - 1) * this.#pitch);
      }

      source.connect(gain);
      const playback: ActivePlayback = { source, url, loop, stopped: false };

      this.#activePlaybacks.add(playback);

      const ended = new Promise<void>((resolve) => {
        source.onended = (): void => {
          this.#finishPlayback(playback, !playback.stopped);
          resolve();
        };
      });

      source.start(0);
      this.#emit('play');

      if (!loop) await ended;
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
    this.#stopActivePlaybacks(false);
    if (this.#visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.#visibilityHandler);
      this.#visibilityHandler = null;
    }
    this.#recreateUnsubscribe?.();
    this.#recreateUnsubscribe = null;
    this.#gain?.disconnect();
    this.#gain = null;
  }

  #normalizePlayOptions(input?: SoundInput | PlayOptions): PlayOptions {
    if (this.#isPlayOptions(input)) return input;

    return { src: input };
  }

  #isPlayOptions(input?: SoundInput | PlayOptions): input is PlayOptions {
    return typeof input === 'object' && input !== null && ('loop' in input || 'replay' in input);
  }

  #stopActivePlaybacks(emitStop: boolean): void {
    const playbacks = [...this.#activePlaybacks];

    if (!playbacks.length) return;

    playbacks.forEach((playback) => {
      playback.stopped = true;

      try {
        playback.source.stop(0);
      } catch {
        /* already stopped */
      }

      this.#finishPlayback(playback, false);
    });

    if (emitStop) this.#emit('stop');
  }

  #finishPlayback(playback: ActivePlayback, emitEnd: boolean): void {
    if (!this.#activePlaybacks.delete(playback)) return;

    try {
      playback.source.disconnect();
    } catch {
      /* already disconnected */
    }

    if (emitEnd) this.#emit('end');
  }

  #restartActiveLoops(): void {
    if (this.#destroyed) return;

    const loopUrls = [...this.#activePlaybacks]
      .filter((playback) => playback.loop)
      .map((playback) => playback.url);

    if (!loopUrls.length) return;

    this.#stopActivePlaybacks(false);
    loopUrls.forEach((src) => {
      void this.#play({ src, loop: true, replay: 'overlap' }, { skipThrottle: true });
    });
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
      this.#needsGainRefresh = false;
    } else if (this.#needsGainRefresh) {
      this.#gain.disconnect();
      this.#gain.connect(ctx.destination);
      this.#needsGainRefresh = false;
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
