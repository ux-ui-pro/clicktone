class $643fcf18b2d2e76f$var$ClickTone {
    file;
    volume;
    callback;
    throttle;
    debug;
    lastClickTime;
    audioCache;
    audioContext;
    constructor({ file: file, volume: volume = 1.0, callback: callback = null, throttle: throttle = 0, debug: debug = false }){
        this.file = file;
        this.volume = volume;
        this.callback = callback;
        this.throttle = throttle;
        this.debug = debug;
        this.lastClickTime = 0;
        this.audioCache = {};
        this.audioContext = null;
    }
    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.iOSFixAudioContext();
        }
    }
    iOSFixAudioContext = ()=>{
        if (this.audioContext && this.audioContext.state === "suspended" && "ontouchstart" in window) {
            const unlock = ()=>{
                if (this.audioContext.state === "suspended") this.audioContext.resume().then(()=>{
                    document.body.removeEventListener("touchstart", unlock);
                    document.body.removeEventListener("touchend", unlock);
                });
            };
            document.body.addEventListener("touchstart", unlock, false);
            document.body.addEventListener("touchend", unlock, false);
        }
    };
    fetchAndDecodeAudio = async (url)=>{
        try {
            if (this.audioCache[url]) return this.audioCache[url];
            const response = await fetch(url);
            const buffer = await response.arrayBuffer();
            const audioData = await this.audioContext.decodeAudioData(buffer);
            this.audioCache[url] = audioData;
            return audioData;
        } catch (error) {
            if (this.debug) // eslint-disable-next-line no-console
            console.error("Audio loading and decoding error: ", error);
            throw new Error(`Something went wrong when loading and decoding the audio: ${error.message}`);
        }
    };
    playAudio = async (url)=>{
        this.initAudioContext();
        try {
            const audioData = await this.fetchAndDecodeAudio(url);
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            source.buffer = audioData;
            gainNode.gain.value = this.volume;
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            source.onended = ()=>{
                if (this.callback) this.callback();
            };
            source.start(0);
        } catch (error) {
            if (this.debug) // eslint-disable-next-line no-console
            console.error("Audio playback error: ", error);
            throw new Error(`Something went wrong while playing audio: ${error.message}`);
        }
    };
    throttleFn = (func)=>()=>{
            const now = Date.now();
            if (now - this.lastClickTime >= this.throttle) {
                func();
                this.lastClickTime = now;
            }
        };
    play = async (url = this.file)=>{
        const throttledPlay = this.throttleFn(()=>this.playAudio(url));
        try {
            await throttledPlay();
        } catch (error) {
            if (this.debug) // eslint-disable-next-line no-console
            console.error("Audio playback error: ", error);
            if (this.callback) this.callback(error);
            else throw error;
        }
    };
}
var $643fcf18b2d2e76f$export$2e2bcd8739ae039 = $643fcf18b2d2e76f$var$ClickTone;


export {$643fcf18b2d2e76f$export$2e2bcd8739ae039 as default};
//# sourceMappingURL=index.module.js.map
