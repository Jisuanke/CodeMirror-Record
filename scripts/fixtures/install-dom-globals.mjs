const constructorNames = [
  'DOMRect',
  'HTMLElement',
  'MutationObserver',
  'Node',
  'Range',
  'Text',
  'Window',
];

/**
 * Install the browser globals expected by CodeMirror into a Node.js process.
 *
 * Node 22 and newer expose `navigator` through a configurable getter without
 * a setter. Defining every fixture global explicitly keeps the setup identical
 * across supported Node releases instead of relying on assignment semantics.
 *
 * @param {{window: Window}} dom
 * @param {typeof globalThis} [target]
 */
export function installDomGlobals(dom, target = globalThis) {
  const {window} = dom;
  const values = {
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    document: window.document,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    navigator: window.navigator,
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    self: window,
    window,
  };

  for (const name of constructorNames) {
    values[name] = window[name];
  }

  Object.defineProperties(target, Object.fromEntries(
      Object.entries(values).map(([name, value]) => [name, {
        configurable: true,
        enumerable: true,
        value,
        writable: true,
      }]),
  ));
}
