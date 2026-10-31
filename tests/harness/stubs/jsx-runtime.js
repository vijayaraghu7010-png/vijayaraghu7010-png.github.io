function node(type, props) { return { type, props: props || {}, __node: true }; }
export function jsx(type, props) { return node(type, props); }
export function jsxs(type, props) { return node(type, props); }
export const Fragment = Symbol('Fragment');
