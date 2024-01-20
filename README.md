<br>
<p align="center"><strong>clicktone</strong></p>

<div align="center">

[![npm](https://img.shields.io/npm/v/clicktone.svg?colorB=brightgreen)](https://www.npmjs.com/package/clicktone)
[![GitHub package version](https://img.shields.io/github/package-json/v/ux-ui-pro/clicktone.svg)](https://github.com/ux-ui-pro/clicktone)
[![NPM Downloads](https://img.shields.io/npm/dm/clicktone.svg?style=flat)](https://www.npmjs.org/package/clicktone)

</div>

<p align="center">A simple class that provides a convenient abstraction for handling<br>
audio playback by web applications, with support for iOS devices.</p>
<p align="center"><a href="https://n2q8x8.csb.app/">Demo</a></p>
<br>

&#10148; **Install**

```
yarn add clicktone
```

<br>

&#10148; **Import**

```javascript
import ClickTone from 'clicktone';
```
<br>

&#10148; **Usage**

<sub>Class uses the Web Audio API, which supports many audio file formats: MP3, WAV, OGG, AAC and others. Please note that not all browsers support these formats.</sub>
```javascript
const clickSound = new ClickTone('./sound.mp3');

myButton.addEventListener('click', () => clickSound.play());
```
<br>

&#10148; **License**

clicktone is released under MIT license.
