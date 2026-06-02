export const UNLOCK_EVENTS: (keyof WindowEventMap)[] = [
  'pointerdown',
  'pointerup',
  'touchstart',
  'touchend',
  'keydown',
];

export const EXT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  opus: 'audio/ogg; codecs=opus',
  wav: 'audio/wav',
  webm: 'audio/webm',
  flac: 'audio/flac',
};
