import {describe, expect, test} from 'vitest';

import {installDomGlobals} from '../scripts/fixtures/install-dom-globals.mjs';

describe('installDomGlobals', () => {
  test('replaces a configurable getter-only navigator', () => {
    const nativeNavigator = {userAgent: 'node'};
    const domNavigator = {userAgent: 'jsdom'};
    const target = {};

    Object.defineProperty(target, 'navigator', {
      configurable: true,
      get: () => nativeNavigator,
    });

    installDomGlobals({
      window: {
        cancelAnimationFrame: () => {},
        document: {},
        innerHeight: 768,
        innerWidth: 1024,
        navigator: domNavigator,
        requestAnimationFrame: () => {},
      },
    }, target);

    expect(target.navigator).toBe(domNavigator);
    expect(Object.getOwnPropertyDescriptor(target, 'navigator')).toMatchObject({
      configurable: true,
      value: domNavigator,
      writable: true,
    });
  });
});
