
function $parcel$defineInteropFlag(a) {
  Object.defineProperty(a, '__esModule', {value: true, configurable: true});
}

function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, {get: v, set: s, enumerable: true, configurable: true});
}

$parcel$defineInteropFlag(module.exports);

$parcel$export(module.exports, "default", () => $4fa36e821943b400$export$2e2bcd8739ae039);
class $4fa36e821943b400$var$ClickTone {
    constructor(options){
        this.file = options.file;
        this.volume = options.volume || 1.0;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.iOSFixAudioContext();
    }
    iOSFixAudioContext() {
        if (this.audioContext.state === "suspended" && "ontouchstart" in window) {
            const unlock = ()=>{
                this.audioContext.resume().then(()=>{
                    document.body.removeEventListener("touchstart", unlock);
                    document.body.removeEventListener("touchend", unlock);
                });
            };
            document.body.addEventListener("touchstart", unlock, false);
            document.body.addEventListener("touchend", unlock, false);
        }
    }
    audio(url) {
        return new Promise((resolve, reject)=>{
            fetch(url).then((response)=>response.arrayBuffer()).then((buffer)=>this.audioContext.decodeAudioData(buffer)).then((audioData)=>{
                const source = this.audioContext.createBufferSource();
                const gainNode = this.audioContext.createGain();
                source.buffer = audioData;
                gainNode.gain.value = this.volume;
                source.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                source.start(0);
                resolve();
            }).catch((error)=>{
                reject(error);
            });
        });
    }
    play(url = this.file) {
        return this.audio(url);
    }
}
var $4fa36e821943b400$export$2e2bcd8739ae039 = $4fa36e821943b400$var$ClickTone;


//# sourceMappingURL=index.js.map
