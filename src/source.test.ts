import { describe, expect, it, vi } from 'vitest';

describe('resolveBestSource', () => {
  it('returns a plain string source as-is', async () => {
    const { resolveBestSource } = await import('./source');

    expect(resolveBestSource('https://cdn.test/click.mp3')).toBe('https://cdn.test/click.mp3');
  });

  it('resolves URL instances to href', async () => {
    const { resolveBestSource } = await import('./source');

    expect(resolveBestSource(new URL('https://cdn.test/click.mp3'))).toBe(
      'https://cdn.test/click.mp3',
    );
  });

  it('throws for empty descriptor source', async () => {
    const { resolveBestSource } = await import('./source');

    expect(() => resolveBestSource({ src: '' })).toThrow('Source descriptor has an empty "src".');
  });

  it('throws when id points to a missing element', async () => {
    const { resolveBestSource } = await import('./source');

    expect(() => resolveBestSource({ id: 'missing-audio-node' })).toThrow(
      'No element found with id "missing-audio-node".',
    );
  });

  it('prefers source with canPlayType=probably when fallback list is provided', async () => {
    const realCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string): HTMLElement => {
        if (tagName.toLowerCase() === 'audio') {
          return {
            canPlayType: (mime: string): string => (mime === 'audio/mpeg' ? 'probably' : ''),
          } as unknown as HTMLElement;
        }

        return realCreateElement(tagName);
      });

    const { resolveBestSource } = await import('./source');

    const result = resolveBestSource([
      { src: '/assets/click.ogg', type: 'audio/ogg' },
      { src: '/assets/click.mp3', type: 'audio/mpeg' },
    ]);

    expect(result).toBe('/assets/click.mp3');
    createElementSpy.mockRestore();
  });
});
