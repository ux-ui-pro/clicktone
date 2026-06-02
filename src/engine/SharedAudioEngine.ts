import { UNLOCK_EVENTS } from '../constants';
import { hasDOM, noop } from '../runtime';

/**
 * One AudioContext shared by every ClickTone instance. iOS caps the number of
 * concurrent AudioContexts, so a single context plus one set of gesture-unlock
 * listeners is both cheaper and far more reliable than per-instance contexts.
 */
export class SharedAudioEngine {
  #ctx: AudioContext | null = null;
  #unlocked = false;
  #primed = false;
  #gestureCleanup: (() => void) | null = null;
  #decodeCache = new Map<string, Promise<AudioBuffer>>();
  #onUnlock = new Set<() => void>();

  get unlocked(): boolean {
    return this.#unlocked;
  }

  prime(): void {
    if (this.#primed || !hasDOM) return;

    this.#primed = true;
    this.#installGestureUnlock();
    this.#installVisibilityHandler();
  }

  context(): AudioContext | null {
    if (this.#ctx || !hasDOM) return this.#ctx;

    const Ctor = window.AudioContext ?? window.webkitAudioContext;

    if (!Ctor) return null;

    try {
      this.#ctx = new Ctor({ latencyHint: 'interactive' });
    } catch {
      this.#ctx = new Ctor();
    }

    return this.#ctx;
  }

  unlock(): void {
    const ctx = this.context();

    if (!ctx) return;

    if (ctx.state === 'running') {
      this.#markUnlocked();

      return;
    }

    void ctx
      .resume()
      .then(() => this.#markUnlocked())
      .catch(noop);
  }

  onUnlock(listener: () => void): void {
    if (this.#unlocked) {
      listener();

      return;
    }

    this.#onUnlock.add(listener);
  }

  decode(url: string): Promise<AudioBuffer> {
    const cached = this.#decodeCache.get(url);

    if (cached) return cached;

    const ctx = this.context();

    if (!ctx) return Promise.reject(new Error('Web Audio API is not available.'));

    const promise = (async (): Promise<AudioBuffer> => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch "${url}": ${response.status} ${response.statusText}`);
      }

      return ctx.decodeAudioData(await response.arrayBuffer());
    })();

    this.#decodeCache.set(url, promise);
    promise.catch(() => this.#decodeCache.delete(url));

    return promise;
  }

  #markUnlocked(): void {
    if (this.#unlocked) return;

    this.#unlocked = true;
    this.#playSilentPing();
    this.#gestureCleanup?.();
    this.#gestureCleanup = null;

    const listeners = [...this.#onUnlock];

    this.#onUnlock.clear();
    listeners.forEach((listener) => {
      listener();
    });
  }

  #playSilentPing(): void {
    const ctx = this.#ctx;

    if (!ctx) return;

    try {
      const buffer = ctx.createBuffer(1, 1, Math.max(22050, ctx.sampleRate));
      const source = ctx.createBufferSource();

      source.buffer = buffer;

      const gain = ctx.createGain();

      gain.gain.value = 0.00001;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
      source.stop(0);
    } catch {
      /* best-effort priming */
    }
  }

  #installGestureUnlock(): void {
    const options: AddEventListenerOptions = { passive: true, capture: true };
    const handler = (): void => this.unlock();

    UNLOCK_EVENTS.forEach((event) => {
      window.addEventListener(event, handler, options);
    });

    this.#gestureCleanup = (): void => {
      UNLOCK_EVENTS.forEach((event) => {
        window.removeEventListener(event, handler, options);
      });
    };
  }

  #installVisibilityHandler(): void {
    const handler = (): void => {
      if (document.hidden || !this.#unlocked) return;

      void this.#ctx?.resume().catch(noop);
    };

    document.addEventListener('visibilitychange', handler);
  }
}

export const engine = new SharedAudioEngine();
