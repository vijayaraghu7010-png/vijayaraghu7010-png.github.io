const g = globalThis;
g.__hooks = g.__hooks || { overrides: {}, setters: [], index: 0 };
export function useState(initial) {
  const i = g.__hooks.index++;
  const value = Object.prototype.hasOwnProperty.call(g.__hooks.overrides, i)
    ? g.__hooks.overrides[i] : initial;
  const setter = (v) => { g.__hooks.setters.push({ index: i, value: typeof v === 'function' ? '(updater)' : v }); };
  return [value, setter];
}
export function useEffect() { /* effects are not run; state is supplied directly */ }
export function useCallback(fn) { return fn; }
export default { useState, useEffect, useCallback };
