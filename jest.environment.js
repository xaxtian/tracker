const { TestEnvironment } = require('jest-environment-jsdom');

/** jsdom plus the Node globals the app relies on and jsdom does not provide. */
class Environment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    const g = this.global;

    /**
     * structuredClone for the jsdom realm. Node's own version does not know
     * jsdom's Blob and would turn it into an empty object, so Blobs (immutable)
     * are passed through as they are. Used by the app and by fake-indexeddb.
     */
    g.structuredClone = function clone(value, seen = new Map()) {
      if (value === null || typeof value !== 'object') {
        if (typeof value === 'function') throw new g.DOMException('function could not be cloned', 'DataCloneError');
        return value;
      }
      if (value instanceof g.Blob) return value;
      if (seen.has(value)) return seen.get(value);
      if (value instanceof Date) return new Date(value.getTime());
      if (value instanceof RegExp) return new RegExp(value.source, value.flags);
      if (value instanceof Map) {
        const m = new Map();
        seen.set(value, m);
        value.forEach((v, k) => m.set(clone(k, seen), clone(v, seen)));
        return m;
      }
      if (value instanceof Set) {
        const s = new Set();
        seen.set(value, s);
        value.forEach((v) => s.add(clone(v, seen)));
        return s;
      }
      if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return structuredClone(value);
      const out = Array.isArray(value) ? [] : {};
      seen.set(value, out);
      for (const k of Object.keys(value)) out[k] = clone(value[k], seen);
      return out;
    };
  }
}

module.exports = Environment;
