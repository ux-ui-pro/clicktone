<br>
<p align="center"><strong>clicktone</strong></p>

<div align="center">

[![npm](https://img.shields.io/npm/v/clicktone.svg?colorB=brightgreen)](https://www.npmjs.com/package/clicktone)
[![GitHub package version](https://img.shields.io/github/package-json/v/ux-ui-pro/clicktone.svg)](https://github.com/ux-ui-pro/clicktone)
[![NPM Downloads](https://img.shields.io/npm/dm/clicktone.svg?style=flat)](https://www.npmjs.org/package/clicktone)

</div>

<p align="center">ClickTone is designed to control audio playback with various settings, including volume control, callback and debug mode. It also includes iOS support.</p>
<p align="center"><sup>850B gzipped</sup></p>
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

<sub>ClickTone uses the Web Audio API, which supports many audio file formats: MP3, WAV, OGG, AAC and others. Note that not all browsers support these formats.</sub>
```javascript
const sound = new ClickTone({
  file: './sound.mp3',
  volume: 0.7,
  throttle: 100,
  callback: () => { console.log('Playback ended') },
  debug: true,
});

const play = () => sound.play();

button.addEventListener('pointerdown', play);
```
<br>

&#10148; **Options**

|   Option   |                Type                 | Default  | Description                                                                                  |
|:----------:|:-----------------------------------:|:--------:|:---------------------------------------------------------------------------------------------|
|   `file`   |              `string`               |  `none`  | The URL of the audio file to be played.                                                      |
|  `volume`  |              `number`               |  `1.0`   | Volume level for the audio playback, ranging from 0.0 (mute) to 1.0 (full volume).           |
| `callback` | `((error?: Error) => void) \| null` |  `null`  | A callback function to be executed after the audio finishes playing, or if an error occurs.  |
| `throttle` |              `number`               |   `0`    | Minimum time (in milliseconds) between successive audio plays to prevent rapid repeat plays. |
|  `debug`   |              `boolean`              | `false`  | If `true`, debug information and errors will be logged to the console.                       |
<br>

&#10148; **License**

clicktone is released under MIT license.
