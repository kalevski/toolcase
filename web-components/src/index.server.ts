// SSR-safe entry point. HTMLElement is not available in Node/SSR environments,
// so importing register.ts (which transitively evaluates `extends HTMLElement`)
// would throw. This module exports a no-op register() so SSR bundlers resolve
// the `node` export condition without touching the browser-only class bodies.
export function register(): void {}
