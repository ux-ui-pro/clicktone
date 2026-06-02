import { EXT_MIME } from './constants';
import { hasDOM } from './runtime';
import type { SoundDescriptor, SoundInput, SoundSource } from './types';

const guessType = (url: string): string | undefined => {
  const clean = url.split(/[?#]/, 1)[0];
  const ext = clean.slice(clean.lastIndexOf('.') + 1).toLowerCase();

  return EXT_MIME[ext];
};

const normalizeSource = (source: SoundSource): SoundDescriptor[] => {
  if (typeof source === 'string') {
    return [{ src: source }];
  }

  if (source instanceof URL) {
    return [{ src: source.href }];
  }

  if (hasDOM && source instanceof HTMLSourceElement) {
    if (!source.src) throw new Error('<source> element has no "src" attribute.');

    return [{ src: source.src, type: source.type || undefined }];
  }

  if (hasDOM && source instanceof HTMLAudioElement) {
    const sources = Array.from(source.querySelectorAll('source'))
      .filter((el) => el.src)
      .map((el) => ({ src: el.src, type: el.type || undefined }));

    if (sources.length) return sources;
    if (source.src) return [{ src: source.src }];

    throw new Error('<audio> element has no playable sources.');
  }

  if (typeof source === 'object' && source !== null && 'id' in source) {
    if (!hasDOM) throw new Error('Cannot resolve element by id outside the DOM.');

    const el = document.getElementById(String(source.id));

    if (!el) throw new Error(`No element found with id "${source.id}".`);

    if (el instanceof HTMLSourceElement || el instanceof HTMLAudioElement) {
      return normalizeSource(el);
    }

    throw new Error(`Element with id "${source.id}" is not a <source> or <audio> element.`);
  }

  if (typeof source === 'object' && source !== null && 'src' in source) {
    if (!source.src) throw new Error('Source descriptor has an empty "src".');

    return [{ src: source.src, type: source.type }];
  }

  throw new Error('Invalid sound source.');
};

export const resolveBestSource = (input: SoundInput): string => {
  const list = (Array.isArray(input) ? input : [input]).flatMap(normalizeSource);

  if (!list.length) throw new Error('No sound source provided.');
  if (list.length === 1 || !hasDOM) return list[0].src;

  const probe = document.createElement('audio');
  let maybe: string | null = null;

  for (const item of list) {
    const type = item.type ?? guessType(item.src);

    if (!type) continue;

    const verdict = probe.canPlayType(type);

    if (verdict === 'probably') return item.src;
    if (verdict === 'maybe' && maybe === null) maybe = item.src;
  }

  return maybe ?? list[0].src;
};
