import assert from 'node:assert/strict';
import test from 'node:test';

const api = await import('../dist/index.es.js').catch(() => null);

test('build artifacts present', () => {
  assert.ok(api);
});

if (api) {
  test('public API exports ClickTone class', () => {
    assert.equal(typeof api.ClickTone, 'function');
  });
}
