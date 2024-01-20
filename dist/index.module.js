class $cf838c15c8b009ba$var$ClickTone {
    constructor({ el: el = "", sound: sound = "" } = {}){
        this.el = el;
        this.sound = sound;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.setupIOSAudioContextFix();
    }
    setupIOSAudioContextFix() {
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
    playAudio(url) {
        fetch(url).then((response)=>response.arrayBuffer()).then((buffer)=>this.audioContext.decodeAudioData(buffer)).then((audioData)=>{
            const source = this.audioContext.createBufferSource();
            source.buffer = audioData;
            source.connect(this.audioContext.destination);
            source.start(0);
        }).catch();
    }
    init() {
        const targetElement = typeof this.el === "string" ? document.querySelector(this.el) : this.el;
        targetElement.addEventListener("click", ()=>{
            this.playAudio(this.sound);
        });
    }
}
var $cf838c15c8b009ba$export$2e2bcd8739ae039 = $cf838c15c8b009ba$var$ClickTone;


export {$cf838c15c8b009ba$export$2e2bcd8739ae039 as default};
//# sourceMappingURL=index.module.js.map
