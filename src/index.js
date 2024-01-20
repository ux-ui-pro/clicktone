class ClickTone {
  constructor({ el = '', sound = '' } = {}) {
    this.el = el;
    this.sound = sound;

    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.setupIOSAudioContextFix();
  }

  setupIOSAudioContextFix() {
    if (this.audioContext.state === 'suspended' && 'ontouchstart' in window) {
      const unlock = () => {
        this.audioContext.resume().then(() => {
          document.body.removeEventListener('touchstart', unlock);
          document.body.removeEventListener('touchend', unlock);
        });
      };

      document.body.addEventListener('touchstart', unlock, false);
      document.body.addEventListener('touchend', unlock, false);
    }
  }

  playAudio(url) {
    fetch(url)
      .then((response) => response.arrayBuffer())
      .then((buffer) => this.audioContext.decodeAudioData(buffer))
      .then((audioData) => {
        const source = this.audioContext.createBufferSource();
        source.buffer = audioData;
        source.connect(this.audioContext.destination);
        source.start(0);
      })
      .catch();
  }

  init() {
    const targetElement =
      typeof this.el === 'string' ? document.querySelector(this.el) : this.el;

    targetElement.addEventListener('click', () => {
      this.playAudio(this.sound);
    });
  }
}

export default ClickTone;
