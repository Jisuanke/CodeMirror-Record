if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback) =>
    setTimeout(() => callback(Date.now()), 0);
}

if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (handle) => clearTimeout(handle);
}

if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [];
}

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}
