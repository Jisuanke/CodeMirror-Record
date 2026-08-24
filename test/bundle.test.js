import {createRequire} from 'node:module';

import {EditorView} from '@codemirror/view';
import {afterEach, describe, expect, test} from 'vitest';

const require = createRequire(import.meta.url);
const {CodePlay, CodeRecord} = require('../dist/index.cjs');
const views = [];

afterEach(() => {
  while (views.length > 0) {
    views.pop().destroy();
  }
  document.body.replaceChildren();
});

describe('published CommonJS bundle', () => {
  test('exposes the two public classes', () => {
    expect(typeof CodePlay).toBe('function');
    expect(typeof CodeRecord).toBe('function');
  });

  test('includes the EventEmitter runtime dependency', () => {
    const parent = document.createElement('div');
    document.body.append(parent);
    const view = new EditorView({parent});
    views.push(view);
    const player = new CodePlay(view);
    let cleared = false;

    player.on('clear', () => {
      cleared = true;
    });
    player.clear();

    expect(cleared).toBe(true);
    expect(player.getStatus()).toBe('PAUSE');
  });
});
