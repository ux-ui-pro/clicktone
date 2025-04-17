declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type FileSource = string | HTMLSourceElement | { id: string };

class ClickTone {
  private readonly fileSource: FileSource;
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
    file: FileSource;
    volume?: number;
    callback?: ((error?: Error) => void) | null;
    throttle?: number;
    debug?: boolean;
  }) {
    this.fileSource = file;
    this.volume = volume;
    this.callback = callback;
    this.throttle = throttle;
    this.debug = debug;
    this.lastClickTime = 0;
    this.audioCache = {};
    this.audioContext = null;
  }

  private resolveFileUrl(file: FileSource): string {
    if (typeof file === 'string') {
      return file;
    }

    if (file instanceof HTMLSourceElement) {
      if (!file.src) {
        throw new Error('<source> element has no "src" attribute.');
      }

      return file.src;
    }

    if (typeof file === 'object' && file !== null && 'id' in file) {
      const el = document.getElementById(String(file.id));

      if (!el) {
        throw new Error(`No element found with id "${file.id}".`);
      }

      if (!(el instanceof HTMLSourceElement)) {
        throw new Error(`Element with id "${file.id}" is not a <source> element.`);
      }

      if (!el.src) {
        throw new Error(`<source> element with id "${file.id}" has no "src" attribute.`);
      }

      return el.src;
    }

    throw new Error('Invalid "file" value. Expected string, HTMLSourceElement, or { id: string }.');
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
              if (this.debug) console.error('AudioContext resume error:', error);
            });
        }
      };

      document.body.addEventListener('touchstart', unlock, false);
      document.body.addEventListener('touchend', unlock, false);
    }
  }

  private async fetchAndDecodeAudio(url: string): Promise<AudioBuffer> {
    try {
      if (this.audioCache[url]) return this.audioCache[url];

      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      const audioData = await this.audioContext!.decodeAudioData(buffer);

      this.audioCache[url] = audioData;

      return audioData;
    } catch (error) {
      if (this.debug) console.error('Audio loading/decoding error:', error);

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
        if (this.callback) this.callback();
      };

      source.start(0);
    } catch (error) {
      if (this.debug) console.error('Audio playback error:', error);

      throw new Error(`Something went wrong while playing audio: ${(error as Error).message}`);
    }
  }

  private throttleFn(func: () => Promise<void>): () => void {
    return () => {
      const now = Date.now();

      if (now - this.lastClickTime >= this.throttle) {
        void func().catch((error) => {
          if (this.debug) console.error('Error in throttled function:', error);
        });

        this.lastClickTime = now;
      }
    };
  }

  public play(file?: FileSource): void {
    let url: string;

    try {
      url = this.resolveFileUrl(file ?? this.fileSource);
    } catch (error) {
      if (this.callback) {
        this.callback(error as Error);

        return;
      }

      throw error;
    }

    const throttledPlay = this.throttleFn(() => this.playAudio(url));

    try {
      throttledPlay();
    } catch (error) {
      if (this.debug) console.error('Audio playback error:', error);
      if (this.callback) this.callback(error as Error);

      else throw error;
    }
  }
}

export default ClickTone;
