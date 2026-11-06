/* Every lucide icon, without naming any of them.

   This stub used to list the icons by hand, so adding one to a panel
   broke four test files until somebody remembered to add it here
   too. That is a test suite failing for a reason that has nothing to
   do with what is being tested.

   CommonJS on purpose: esbuild checks named imports against an ESM
   module's exports and would refuse an unknown one, but it resolves
   them against a CommonJS module at runtime, which lets this answer
   for any name a panel asks for. */

const made = new Map();

const icon = (name) =>
  function Icon() {
    return { type: 'icon:' + name, props: {}, __node: true };
  };

module.exports = new Proxy(
  {},
  {
    get(_target, name) {
      if (typeof name !== 'string') return undefined;
      /* Let the bundler's own interop questions through unanswered. */
      if (name === '__esModule' || name === 'default') return undefined;
      if (!made.has(name)) made.set(name, icon(name));
      return made.get(name);
    },
    has() {
      return true;
    }
  }
);
