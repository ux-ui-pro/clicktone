import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeBufferSource = {
  buffer: AudioBuffer | null;
  loop: boolean;
  playbackRate: { value: number };
  onended: (() => void) | null;
  connect: () => void;
  disconnect: () => void;
  start: () => void;
  stop: () => void;
  stopped: boolean;
};

const installAudioMocks = (
  options: { advancingTime?: boolean } = {},
): {
  fetchSpy: ReturnType<typeof vi.fn>;
  instances: { closed: boolean }[];
  sources: FakeBufferSource[];
} => {
  const { advancingTime = false } = options;
  const fetchSpy = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => new ArrayBuffer(8),
  }));

  const instances: { closed: boolean }[] = [];
  const sources: FakeBufferSource[] = [];

  const fakeAudioContextClass = class FakeAudioContext {
    state: AudioContextState = 'suspended';
    sampleRate = 44100;
    #t = 0;
    destination = {};
    closed = false;

    constructor() {
      instances.push(this);
    }

    get currentTime(): number {
      // A healthy running context keeps advancing currentTime; a zombie one
      // reports "running" but stays frozen at 0.
      if (advancingTime) this.#t += 0.05;

      return this.#t;
    }

    async resume(): Promise<void> {
      this.state = 'running';
    }

    async close(): Promise<void> {
      this.closed = true;
      this.state = 'closed';
    }

    createGain(): GainNode {
      const gain = {
        value: 1,
        cancelScheduledValues: () => {},
        setValueAtTime: () => {},
        linearRampToValueAtTime: () => {},
      };

      return {
        gain,
        connect: () => {},
        disconnect: () => {},
      } as unknown as GainNode;
    }

    createBuffer(): AudioBuffer {
      return { duration: 0.05 } as AudioBuffer;
    }

    createBufferSource(): AudioBufferSourceNode {
      const node: FakeBufferSource = {
        buffer: null,
        loop: false,
        playbackRate: { value: 1 },
        onended: null,
        connect: () => {},
        disconnect: () => {},
        start: () => {
          if (!node.loop) queueMicrotask(() => node.onended?.());
        },
        stop: () => {
          node.stopped = true;
          queueMicrotask(() => node.onended?.());
        },
        stopped: false,
      };

      sources.push(node);

      return node as unknown as AudioBufferSourceNode;
    }

    async decodeAudioData(): Promise<AudioBuffer> {
      return { duration: 0.05 } as AudioBuffer;
    }
  };

  vi.stubGlobal('fetch', fetchSpy);
  vi.stubGlobal('AudioContext', fakeAudioContextClass);
  vi.stubGlobal('webkitAudioContext', fakeAudioContextClass);

  return { fetchSpy, instances, sources };
};

describe('ClickTone', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('emits play and end events on successful playback', async () => {
    installAudioMocks();
    const { ClickTone } = await import('../../src/main');
    const sound = new ClickTone({ src: '/assets/click.wav' });

    const playHandler = vi.fn();
    const endHandler = vi.fn();
    sound.on('play', playHandler);
    sound.on('end', endHandler);

    await sound.play();

    expect(playHandler).toHaveBeenCalledTimes(1);
    expect(endHandler).toHaveBeenCalledTimes(1);
  });

  it('emits load event on preload', async () => {
    installAudioMocks();
    const { ClickTone } = await import('../../src/main');
    const sound = new ClickTone({ src: '/assets/click.wav' });

    const loadHandler = vi.fn();
    sound.on('load', loadHandler);

    await sound.preload();

    expect(loadHandler).toHaveBeenCalledTimes(1);
  });

  it('emits error when source is invalid', async () => {
    installAudioMocks();
    const { ClickTone } = await import('../../src/main');
    const sound = new ClickTone({ src: { src: '' } });

    const errorHandler = vi.fn();
    sound.on('error', errorHandler);

    await sound.play();

    expect(errorHandler).toHaveBeenCalledTimes(1);
    const [error] = errorHandler.mock.calls[0] as [Error];
    expect(error.message).toContain('Source descriptor has an empty "src".');
  });

  it('applies throttle to suppress rapid sequential play requests', async () => {
    const { fetchSpy } = installAudioMocks();
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1000).mockReturnValue(1000);

    const { ClickTone } = await import('../../src/main');
    const sound = new ClickTone({ src: '/assets/click.wav', throttle: 500 });

    await sound.play('/assets/a.wav');
    await sound.play('/assets/b.wav');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/assets/a.wav');
  });

  it('keeps loop playback active until stopped', async () => {
    const { sources } = installAudioMocks();
    const { ClickTone } = await import('../../src/main');
    const sound = new ClickTone({ src: '/assets/loop.wav', loop: true });

    const stopHandler = vi.fn();
    const endHandler = vi.fn();
    sound.on('stop', stopHandler);
    sound.on('end', endHandler);

    await sound.play();

    expect(sound.playing).toBe(true);
    expect(sources.some((source) => source.loop)).toBe(true);

    sound.stop();

    expect(sound.playing).toBe(false);
    expect(stopHandler).toHaveBeenCalledTimes(1);
    expect(endHandler).not.toHaveBeenCalled();
  });

  it('can ignore play requests while already playing', async () => {
    const { fetchSpy } = installAudioMocks();
    const { ClickTone } = await import('../../src/main');
    const sound = new ClickTone({ src: '/assets/loop.wav', loop: true });

    await sound.play();
    await sound.play({ src: '/assets/ignored.wav', replay: 'ignore-if-playing' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith('/assets/loop.wav');
  });

  it('can interrupt active playback before starting another sound', async () => {
    const { fetchSpy, sources } = installAudioMocks();
    const { ClickTone } = await import('../../src/main');
    const sound = new ClickTone({ src: '/assets/loop.wav', loop: true });

    const stopHandler = vi.fn();
    sound.on('stop', stopHandler);

    await sound.play();
    await sound.play({ src: '/assets/hit.wav', replay: 'interrupt' });

    expect(fetchSpy).toHaveBeenCalledWith('/assets/loop.wav');
    expect(fetchSpy).toHaveBeenCalledWith('/assets/hit.wav');
    expect(sources.some((source) => source.loop && source.stopped)).toBe(true);
    expect(stopHandler).toHaveBeenCalledTimes(1);
  });

  const withAppleUA = async (run: () => Promise<void>): Promise<void> => {
    const originalUA = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    try {
      await run();
    } finally {
      Object.defineProperty(navigator, 'userAgent', {
        value: originalUA,
        configurable: true,
      });
    }
  };

  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

  it('hard-recreates a zombie AudioContext after a lifecycle return on Apple WebKit', async () => {
    await withAppleUA(async () => {
      const { fetchSpy, instances } = installAudioMocks({ advancingTime: false });
      const { ClickTone } = await import('../../src/main');
      const sound = new ClickTone({ src: '/assets/click.wav' });

      await sound.play();

      expect(instances).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Returning to the tab kicks off a background zombie probe; the frozen
      // currentTime marks the context as dead.
      document.dispatchEvent(new Event('visibilitychange'));
      await wait(300);

      await sound.play();

      // Old context closed, a fresh one built, and the decode cache dropped.
      expect(instances).toHaveLength(2);
      expect(instances[0].closed).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('keeps a healthy AudioContext after a lifecycle return on Apple WebKit', async () => {
    await withAppleUA(async () => {
      const { fetchSpy, instances } = installAudioMocks({ advancingTime: true });
      const { ClickTone } = await import('../../src/main');
      const sound = new ClickTone({ src: '/assets/click.wav' });

      await sound.play();

      expect(instances).toHaveLength(1);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Advancing currentTime means the probe finds the context alive, so no
      // recreate and the decode cache survives.
      document.dispatchEvent(new Event('visibilitychange'));
      await wait(300);

      await sound.play();

      expect(instances).toHaveLength(1);
      expect(instances[0].closed).toBe(false);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
