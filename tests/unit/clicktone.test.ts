import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type FakeBufferSource = {
  buffer: AudioBuffer | null;
  playbackRate: { value: number };
  onended: (() => void) | null;
  connect: () => void;
  disconnect: () => void;
  start: () => void;
  stop: () => void;
};

const installAudioMocks = (): { fetchSpy: ReturnType<typeof vi.fn> } => {
  const fetchSpy = vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => new ArrayBuffer(8),
  }));

  const fakeAudioContextClass = class FakeAudioContext {
    state: AudioContextState = 'suspended';
    sampleRate = 44100;
    currentTime = 0;
    destination = {};

    async resume(): Promise<void> {
      this.state = 'running';
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
        playbackRate: { value: 1 },
        onended: null,
        connect: () => {},
        disconnect: () => {},
        start: () => {
          queueMicrotask(() => node.onended?.());
        },
        stop: () => {},
      };

      return node as unknown as AudioBufferSourceNode;
    }

    async decodeAudioData(): Promise<AudioBuffer> {
      return { duration: 0.05 } as AudioBuffer;
    }
  };

  vi.stubGlobal('fetch', fetchSpy);
  vi.stubGlobal('AudioContext', fakeAudioContextClass);
  vi.stubGlobal('webkitAudioContext', fakeAudioContextClass);

  return { fetchSpy };
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
});
