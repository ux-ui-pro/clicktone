import { UNLOCK_EVENTS } from '../constants';
import { hasDOM, isAppleWebAudioFlaky, noop } from '../runtime';

/**
 * One AudioContext shared by every ClickTone instance. iOS caps the number of
 * concurrent AudioContexts, so a single context plus one set of gesture-unlock
 * listeners is both cheaper and far more reliable than per-instance contexts.
 */
export class SharedAudioEngine {
  static readonly #ZOMBIE_PROBE_MS = 200;

  #ctx: AudioContext | null = null;
  #unlocked = false;
  #primed = false;
  #needsHardRecovery = false;
  #probing = false;
  #decodeCache = new Map<string, Promise<AudioBuffer>>();
  #onUnlock = new Set<() => void>();
  #onRecreate = new Set<() => void>();

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
    // Runs inside a user gesture (gesture listeners + start of play()). iOS
    // refuses to fully start a context outside a gesture, so this is the only
    // safe place to perform the hard recovery flagged on lifecycle return.
    if (this.#needsHardRecovery) this.#recreate();

    const ctx = this.context();

    if (!ctx) return;

    if (ctx.state === 'running') {
      if (this.#unlocked) {
        this.#playSilentPing();
      } else {
        this.#markUnlocked();
      }

      return;
    }

    void ctx
      .resume()
      .then(() => {
        if (this.#unlocked) {
          this.#playSilentPing();
        } else {
          this.#markUnlocked();
        }
      })
      .catch(noop);
  }

  async ensureRunning(): Promise<AudioContext | null> {
    const ctx = this.context();

    if (!ctx) return null;

    const attempt = async (): Promise<boolean> => {
      if (this.#isRunning(ctx)) {
        if (this.#unlocked) {
          this.#playSilentPing();
        } else {
          this.#markUnlocked();
        }

        return true;
      }

      try {
        await ctx.resume();
      } catch {
        /* iOS may transiently reject resume */
      }

      if (this.#isRunning(ctx)) {
        if (this.#unlocked) {
          this.#playSilentPing();
        } else {
          this.#markUnlocked();
        }

        return true;
      }

      return false;
    };

    if (await attempt()) return ctx;
    await new Promise((resolve) => setTimeout(resolve, 120));
    if (await attempt()) return ctx;
    await new Promise((resolve) => setTimeout(resolve, 600));
    await attempt();

    return ctx;
  }

  #isRunning(ctx: AudioContext): boolean {
    return ctx.state === 'running';
  }

  /**
   * After a lifecycle return, decide whether the context is genuinely dead and
   * needs recreating, instead of recreating unconditionally. Runs in the
   * background (no user gesture required) because it only reads state and
   * `currentTime`:
   *
   * - A healthy context keeps advancing `currentTime` while `running`.
   * - A zombie context reports `running` but `currentTime` stays frozen.
   * - A context that cannot even reach `running` in the background needs a
   *   gesture-driven restart, which the recreate path provides safely.
   *
   * Recreation itself is deferred to the next user gesture via
   * `#needsHardRecovery` (iOS refuses a full start outside a gesture).
   */
  async #probeForZombie(): Promise<void> {
    if (this.#probing || this.#needsHardRecovery) return;

    const ctx = this.#ctx;

    if (!ctx || !this.#unlocked) return;

    this.#probing = true;

    try {
      if (ctx.state !== 'running') {
        try {
          await ctx.resume();
        } catch {
          /* iOS may reject a background resume; gesture recreate will cover it */
        }
      }

      if (ctx.state !== 'running') {
        this.#needsHardRecovery = true;

        return;
      }

      const start = ctx.currentTime;

      await new Promise((resolve) => setTimeout(resolve, SharedAudioEngine.#ZOMBIE_PROBE_MS));

      if (ctx.state === 'running' && ctx.currentTime <= start) {
        this.#needsHardRecovery = true;
      }
    } finally {
      this.#probing = false;
    }
  }

  /**
   * Tear down the current (potentially zombie) AudioContext and build a fresh
   * one. AudioBuffers are bound to a specific context, so the decode cache must
   * be dropped; ClickTone#ensureGain rebinds its GainNode when the context
   * changes. Must be called inside a user gesture.
   */
  #recreate(): void {
    this.#needsHardRecovery = false;

    const old = this.#ctx;

    this.#ctx = null;
    this.#decodeCache.clear();

    if (old) void old.close().catch(noop);

    const ctx = this.context();

    if (!ctx) return;

    const listeners = [...this.#onRecreate];
    listeners.forEach((listener) => {
      listener();
    });

    void ctx
      .resume()
      .then(() => this.#playSilentPing())
      .catch(noop);
  }

  onUnlock(listener: () => void): void {
    if (this.#unlocked) {
      listener();

      return;
    }

    this.#onUnlock.add(listener);
  }

  onRecreate(listener: () => void): () => void {
    this.#onRecreate.add(listener);

    return () => this.#onRecreate.delete(listener);
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
  }

  #installVisibilityHandler(): void {
    const appleFlaky = isAppleWebAudioFlaky();

    const wake = (): void => {
      if (!this.#unlocked) return;

      if (appleFlaky) {
        // On Apple WebKit the context can come back "running" but silent
        // (zombie). Probe it in the background; only if it is actually dead do
        // we flag a hard recreate, which then runs inside the next user
        // gesture (iOS refuses a full start outside a gesture).
        void this.#probeForZombie();

        return;
      }

      // Other engines just need a resume nudge after background transitions.
      this.unlock();
      setTimeout(() => this.unlock(), 120);
      setTimeout(() => this.unlock(), 600);
    };

    const handler = (): void => {
      if (document.hidden || !this.#unlocked) return;

      wake();
    };

    document.addEventListener('visibilitychange', handler);
    window.addEventListener('pageshow', wake);
  }
}

export const engine = new SharedAudioEngine();
