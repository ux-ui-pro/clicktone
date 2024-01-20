<br>
<p align="center"><strong>clicktone</strong></p>

<div align="center">

[![npm](https://img.shields.io/npm/v/clicktone.svg?colorB=brightgreen)](https://www.npmjs.com/package/clicktone)
[![GitHub package version](https://img.shields.io/github/package-json/v/ux-ui-pro/clicktone.svg)](https://github.com/ux-ui-pro/clicktone)
[![NPM Downloads](https://img.shields.io/npm/dm/clicktone.svg?style=flat)](https://www.npmjs.org/package/clicktone)

</div>

<p align="center">A simple class to create elements that play audio when clicked.</p>
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

<sup>You can pass type, class, or ID selectors, as well as the DOM element itself, as parameters for 'el'.</sup>
```javascript
const clickTone = new ClickTone({
  el: '#button',
  sound: 'sound.mp3',
});

clickTone.init();
```
<br>

&#10148; **License**

clicktone is released under MIT license.
