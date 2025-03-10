declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

class ClickTone {
  private readonly file: string;
  private readonly volume: number;
  private readonly callback: ((error?: Error) => void) | null;
  private readonly throttle: number;
  private readonly debug: boolean;
  private lastClickTime: number;
  private readonly audioCache: Record<string, AudioBuffer>;
  private audioContext: AudioContext | null;

  constructor({
    file,
    volume = 1.0,
    callback = null,
    throttle = 0,
    debug = false,
  }: {
    file: string;
    volume?: number;
    callback?: ((error?: Error) => void) | null;
    throttle?: number;
    debug?: boolean;
  }) {
    this.file = file;
    this.volume = volume;
    this.callback = callback;
    this.throttle = throttle;
    this.debug = debug;
    this.lastClickTime = 0;
    this.audioCache = {};
    this.audioContext = null;
  }

  private initAudioContext(): void {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.iOSFixAudioContext();
    }
  }

  private iOSFixAudioContext(): void {
    if (this.audioContext && this.audioContext.state === 'suspended' && 'ontouchstart' in window) {
      const unlock = (): void => {
        if (this.audioContext!.state === 'suspended') {
          void this.audioContext!.resume()
            .then(() => {
              document.body.removeEventListener('touchstart', unlock);
              document.body.removeEventListener('touchend', unlock);
            })
            .catch((error) => {
              if (this.debug) {
                console.error('AudioContext resume error:', error);
              }
            });
        }
      };

      document.body.addEventListener('touchstart', unlock, false);
      document.body.addEventListener('touchend', unlock, false);
    }
  }

  private async fetchAndDecodeAudio(url: string): Promise<AudioBuffer> {
    try {
      if (this.audioCache[url]) {
        return this.audioCache[url];
      }

      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const audioData = await this.audioContext!.decodeAudioData(buffer);

      this.audioCache[url] = audioData;

      return audioData;
    } catch (error) {
      if (this.debug) {
        console.error('Audio loading and decoding error: ', error);
      }

      throw new Error(
        `Something went wrong when loading and decoding the audio: ${(error as Error).message}`,
      );
    }
  }

  private async playAudio(url: string): Promise<void> {
    this.initAudioContext();

    try {
      const audioData = await this.fetchAndDecodeAudio(url);
      const source = this.audioContext!.createBufferSource();
      const gainNode = this.audioContext!.createGain();

      source.buffer = audioData;

      gainNode.gain.value = this.volume;

      source.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      source.onended = (): void => {
        if (this.callback) {
          this.callback();
        }
      };

      source.start(0);
    } catch (error) {
      if (this.debug) {
        console.error('Audio playback error: ', error);
      }

      throw new Error(`Something went wrong while playing audio: ${(error as Error).message}`);
    }
  }

  private throttleFn(func: () => Promise<void>): () => void {
    return () => {
      const now = Date.now();

      if (now - this.lastClickTime >= this.throttle) {
        void func().catch((error) => {
          if (this.debug) {
            console.error('Error in throttled function:', error);
          }
        });

        this.lastClickTime = now;
      }
    };
  }

  public play(url: string = this.file): void {
    const throttledPlay = this.throttleFn(() => this.playAudio(url));

    try {
      throttledPlay();
    } catch (error) {
      if (this.debug) {
        console.error('Audio playback error: ', error);
      }

      if (this.callback) {
        this.callback(error as Error);
      } else {
        throw error;
      }
    }
  }
}

export default ClickTone;
