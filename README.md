# clicktone

A lightweight helper for UI sound feedback. It wraps the Web Audio API with a tiny, event-based API and a rock-solid iOS/Safari unlock.

- Single shared `AudioContext` for every instance (no iOS context-limit issues).
- Reliable autoplay unlock: eager gesture listeners, synchronous resume, silent priming ping, re-resume on `visibilitychange`.
- Automatic format fallback via `canPlayType` (great for Safari, which dislikes OGG/Opus).
- Shared decode cache, throttling, volume control, and subtle pitch variation.
- Event-based (`EventTarget`) with a typed `on()` / `once()` API; `play()` also returns a `Promise`.

## Install

```bash
yarn add clicktone
```

## Usage (TypeScript)

```ts
import { ClickTone } from 'clicktone';

const button = document.getElementById('clickBtn');

if (!button) {
  throw new Error('Demo DOM is not ready');
}

const sound = new ClickTone({
  // A single source…
  src: new URL('./assets/click.mp3', import.meta.url).href,

  // …or a fallback list; the best supported format is picked automatically:
  // src: ['./click.aac', './click.ogg', './click.mp3'],

  volume: 0.7,
  throttle: 100,
  pitchVariation: 0.08,
  preload: true,
});

sound.on('error', (error) => console.error(error));
button.addEventListener('click', () => sound.play());
```

The `src` option also accepts DOM elements: an `HTMLSourceElement`, an `HTMLAudioElement` (its child `<source>` elements become the fallback list), or `{ id }` referencing either of those by id.

## Usage (Vue 3)

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue';
import { ClickTone } from 'clicktone';

const sound = shallowRef<ClickTone | null>(null);

onMounted(() => {
  sound.value = new ClickTone({
    src: new URL('./assets/click.mp3', import.meta.url).href,
    volume: 0.7,
    pitchVariation: 0.08,
    preload: true,
  });
});

onBeforeUnmount(() => {
  sound.value?.destroy();
  sound.value = null;
});
</script>

<template>
  <button @click="sound?.play()">Click</button>
</template>
```

## Events

`ClickTone` extends `EventTarget`. Subscribe with the typed `on()` / `once()` helpers (which return an unsubscribe function) or with native `addEventListener`.

```ts
const off = sound.on('end', () => console.log('finished'));
sound.on('error', (error) => console.error(error));
sound.once('unlock', () => console.log('audio unlocked'));

off();

// play() also resolves when playback ends:
await sound.play();
```

| Event    | Detail        | Fired when                                 |
|:---------|:--------------|:-------------------------------------------|
| `play`   | —             | A buffer source has started.               |
| `end`    | —             | Playback finished.                         |
| `unlock` | —             | The shared `AudioContext` became playable. |
| `load`   | `AudioBuffer` | A source was fetched and decoded.          |
| `error`  | `Error`       | Loading, decoding, or playback failed.     |

## iOS / Safari unlock

Mobile browsers (especially Safari on iOS) block audio until the user interacts with the page, an `AudioContext` must be resumed synchronously inside a user gesture, and iOS caps the number of contexts you may create. ClickTone handles all of this:

- One shared `AudioContext` (with `latencyHint: 'interactive'`) — one unlock unlocks every instance.
- Global gesture listeners (`pointerdown` / `pointerup` / `touchstart` / `touchend` / `keydown`) resume the context on the first interaction anywhere on the page.
- A silent priming ping is played right after unlock, and the context is re-resumed on `visibilitychange`.
- Decoded buffers are cached and shared, so the first click is not delayed by the network.

Pass `preload: true` (or call `sound.preload()`) so the buffer is decoded ahead of the first click. Include an MP3/AAC source for Safari — OGG/Opus is not reliably supported there.

```ts
await sound.preload();

// Or unlock the shared context on a known first interaction:
document.addEventListener('pointerdown', () => ClickTone.unlock(), { once: true });
```

## Options

| Option           | Type                                                                                        | Default | Description                                                                  |
|:-----------------|:--------------------------------------------------------------------------------------------|:-------:|:-----------------------------------------------------------------------------|
| `src`            | `string \| URL \| {src,type?} \| {id} \| HTMLSourceElement \| HTMLAudioElement \| Array<…>` |    —    | Audio source(s). Pass an array to enable automatic format fallback.          |
| `volume`         | `number`                                                                                    |   `1`   | Playback volume `0`–`1`.                                                     |
| `muted`          | `boolean`                                                                                   | `false` | Start muted. Toggle later via `setMuted()` / `toggleMuted()`.                |
| `throttle`       | `number`                                                                                    |   `0`   | Debounce interval in ms. Requests arriving sooner are ignored.               |
| `pitchVariation` | `number`                                                                                    |   `0`   | `0`–`1`. Random playback-rate jitter so repeated clicks don't sound identical. |
| `preload`        | `boolean`                                                                                   | `false` | Fetch and decode the buffer on construction.                                 |
| `debug`          | `boolean`                                                                                   | `false` | Log internal errors to the console (in addition to the `error` event).       |

## Methods

```ts
await sound.play();          // optionally play(src) to override the source
await sound.preload();       // optionally preload(src)
sound.unlock();
sound.setVolume(0.5);        // smoothly ramped
sound.setMuted(true);
sound.toggleMuted();
sound.on('end', () => {});   // on(type, fn) / once(type, fn)
sound.destroy();

ClickTone.unlock();          // static: unlock the shared context
ClickTone.unlocked;          // static: whether the shared context is unlocked
```

## License

MIT
