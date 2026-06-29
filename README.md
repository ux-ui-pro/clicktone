# clicktone

A lightweight helper for UI sound feedback. It wraps the Web Audio API with a tiny, event-based API and a rock-solid iOS/Safari unlock.

- Single shared `AudioContext` for every instance (no iOS context-limit issues).
- Reliable autoplay unlock: eager gesture listeners, synchronous resume, silent priming ping, re-resume on `visibilitychange`.
- Self-healing on iOS/Safari: detects a "zombie" context after tab/app switch or lock-screen and transparently rebuilds it on the next interaction.
- Automatic format fallback via `canPlayType` (great for Safari, which dislikes OGG/Opus).
- Shared decode cache, throttling, volume control, loop playback, stop control, and subtle pitch variation.
- Event-based (`EventTarget`) with a typed `on()` / `once()` API; `play()` also returns a `Promise`.
- [Demo](https://codepen.io/ux-ui/pen/yLwbmMr)

## Install

```bash
npm install clicktone
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
sound.on('stop', () => console.log('stopped'));

off();

// play() also resolves when playback ends:
await sound.play();
```

| Event    | Detail        | Fired when                                  |
|:---------|:--------------|:--------------------------------------------|
| `play`   | —             | A buffer source has started.                |
| `end`    | —             | Playback finished naturally.                |
| `stop`   | —             | Active playback was stopped explicitly.     |
| `unlock` | —             | The shared `AudioContext` became playable.  |
| `load`   | `AudioBuffer` | A source was fetched and decoded.           |
| `error`  | `Error`       | Loading, decoding, or playback failed.      |

## iOS / Safari unlock

Mobile browsers (especially Safari on iOS) block audio until the user interacts with the page, an `AudioContext` must be resumed synchronously inside a user gesture, and iOS caps the number of contexts you may create. ClickTone handles all of this:

- One shared `AudioContext` (with `latencyHint: 'interactive'`) — one unlock unlocks every instance.
- Global gesture listeners (`pointerdown` / `pointerup` / `touchstart` / `touchend` / `keydown`) resume the context on the first interaction anywhere on the page.
- A silent priming ping is played right after unlock, and the context is re-resumed on `visibilitychange`.
- Lifecycle recovery for Safari/iOS: after a tab switch, app switch, or lock-screen, WebKit can leave the context in a "zombie" state (it reports `running` but stays silent). ClickTone probes for this on return and, if the context is dead, rebuilds it inside the next user gesture — buffers re-decode and the gain graph rebinds automatically.
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
| `loop`           | `boolean`                                                                                   | `false` | Keep playback running until `stop()` is called.                              |
| `replay`         | `'overlap' \| 'interrupt' \| 'ignore-if-playing' \| 'restart'`                              | `'overlap'` | Behavior when `play()` is called while this instance is already playing. |
| `debug`          | `boolean`                                                                                   | `false` | Log internal errors to the console (in addition to the `error` event).       |

## Methods

```ts
await sound.play();          // optionally play(src) to override the source
await sound.play({ loop: true });
await sound.play({ src: '/win.mp3', replay: 'interrupt' });
await sound.preload();       // optionally preload(src)
sound.unlock();
sound.stop();
sound.playing;               // whether this instance has active playback
sound.setVolume(0.5);        // smoothly ramped
sound.setMuted(true);
sound.toggleMuted();
sound.on('end', () => {});   // on(type, fn) / once(type, fn)
sound.destroy();

ClickTone.unlock();          // static: unlock the shared context
ClickTone.unlocked;          // static: whether the shared context is unlocked
```

### Replay behavior

- `overlap` (default): preserve classic SFX behavior — every accepted `play()` call starts another buffer source.
- `interrupt`: stop active playback, then start the requested sound.
- `ignore-if-playing`: ignore the request while this instance is already playing.
- `restart`: stop active playback and start again, bypassing `throttle`.

For looped playback, `play()` resolves after the loop starts rather than waiting forever for a natural end. Use `stop()` to end it.

## Interruptible sounds / game patterns

Use one `ClickTone` instance for a long-running process sound and separate instances for terminal SFX:

```ts
const flying = new ClickTone({
  src: new URL('./assets/flying.mp3', import.meta.url).href,
  loop: true,
  preload: true,
});

const bonus = new ClickTone({
  src: new URL('./assets/bonus.mp3', import.meta.url).href,
  preload: true,
});

await flying.play(); // resolves once the loop starts

// Later, when the player wins:
flying.stop();
await bonus.play();
```

You can also encode the interruption policy on a single instance:

```ts
const terminal = new ClickTone({
  src: new URL('./assets/explosion.mp3', import.meta.url).href,
  replay: 'interrupt',
  preload: true,
});

await terminal.play();
```

## License

MIT
