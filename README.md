<br>
<p align="center"><strong>clicktone</strong></p>

<div align="center">

[![npm](https://img.shields.io/npm/v/clicktone.svg?colorB=brightgreen)](https://www.npmjs.com/package/clicktone)
[![GitHub package version](https://img.shields.io/github/package-json/v/ux-ui-pro/clicktone.svg)](https://github.com/ux-ui-pro/clicktone)
[![NPM Downloads](https://img.shields.io/npm/dm/clicktone.svg?style=flat)](https://www.npmjs.org/package/clicktone)

</div>

<p align="center">ClickTone is a lightweight helper for UI sound feedback. It wraps the Web Audio API, giving you instant click‑sounds with volume control, throttling, callbacks, and an iOS resume workaround.</p>
<p align="center"><sup>1.2kB gzipped</sup></p>
<p align="center"><a href="https://codepen.io/ux-ui/pen/yLwbmMr">Demo</a></p>
<br>

&#10148; **Install**

```console
yarn add clicktone
```

<br>

&#10148; **Import**

```javascript
import ClickTone from 'clicktone';
```
<br>

&#10148; **Usage**

```html
<audio preload="auto">
  <source id="click-source" src="./click.mp3" type="audio/mpeg" />
  <source src="./click.ogg" type="audio/ogg" />
</audio>
```

```javascript
const sound = new ClickTone({
  // Any of the forms work:
  // file: './sound.mp3',
  // file: new URL('./sound.mp3', import.meta.url).href,
  // file: document.querySelector('#click-source') as HTMLSourceElement,
  file: { id: 'click-source' },

  volume: 0.7,
  throttle: 100,
  callback: () => console.log('done'),
  debug: true,
});

button.addEventListener('click', () => click.play());
```
<sup>ClickTone uses the Web Audio API, which supports many audio file formats: MP3, WAV, OGG, AAC and others. Note that not all browsers support these formats.</sup>
<br>
<sup>Tip: you can also override the source at call‑time: click.play('./alt.wav').</sup>
<br><br>

&#10148; **Options**

|   Option   |                      Type                       | Default | Description                                                                                                                     |
|:----------:|:-----------------------------------------------:|:-------:|:--------------------------------------------------------------------------------------------------------------------------------|
|   `file`   | `string \| HTMLSourceElement \| { id: string }` |    –    | Audio source. Either a direct URL, an actual `<source>` element, or an object whose id maps to a `<source>` already in the DOM. |
|  `volume`  |                    `number`                     |   `1`   | Playback volume `0`–`1`.                                                                                                        |
| `callback` |       `((error?: Error) => void) \| null`       | `null`  | Called after playback ends or if an error occurs.                                                                               |
| `throttle` |                    `number`                     |   `0`   | Debounce interval in ms. Playback requests arriving sooner are ignored.                                                         |
|  `debug`   |                    `boolean`                    | `false` | Log internal errors/warnings to the console.                                                                                    |
<br>

&#10148; **License**

clicktone is released under MIT license.
