const assert = require('node:assert/strict');
const test = require('node:test');

const {CodePlay, CodeRecord} = require('../dist/main.js');

test('published bundle exposes the public classes', () => {
  assert.equal(typeof CodePlay, 'function');
  assert.equal(typeof CodeRecord, 'function');
});

test('CodePlay includes its EventEmitter runtime dependency', () => {
  const player = new CodePlay({});
  let cleared = false;

  player.on('clear', () => {
    cleared = true;
  });
  player.clear();

  assert.equal(cleared, true);
  assert.equal(player.getStatus(), 'PAUSE');
});
