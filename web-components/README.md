# @toolcase/web-components

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/web-components?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/web-components)

**Framework-free** HTML5 Web Components (`tc-*`) with their own from-scratch toolcase styling — no Bootstrap dependency, but a Bootstrap-compatible class and 12-column grid API. Drop them into plain HTML, React, Vue, Svelte, Angular, or any other stack — no framework required.

📖 Live demos: **[toolcase.kalevski.dev/web-components](https://toolcase.kalevski.dev/web-components)**

## Install

```bash
npm install @toolcase/web-components
```

### Peer dependencies

- `@toolcase/base ^3.x`

## Setup

```ts
import { register } from '@toolcase/web-components'
import '@toolcase/web-components/style.css'

register() // registers every tc-* element on window.customElements
```

### SSR / Next.js / server-side rendering

All `tc-*` component classes extend `HTMLElement`, which does not exist in Node.js. A top-level `import '@toolcase/web-components'` in server-rendered code will throw `ReferenceError: HTMLElement is not defined` at module evaluation time, before any idempotency guard can run.

**Node.js environments** (Next.js SSR, RSC, prerender, Vitest with `environment: 'node'`) automatically resolve the `node` export condition to a no-op stub that exports a safe `register()` — so `require`/`import` from server code will not throw.

**Client-side registration** must use a dynamic import inside `useEffect` or another client-only boundary, never a static top-level import in a component file that is also rendered on the server:

```ts
// Next.js app directory (client component) — safe pattern
'use client'
import { useEffect } from 'react'

useEffect(() => {
    void import('@toolcase/web-components').then(m => m.register())
}, [])
```

The stylesheet import is also unsafe at the top level in RSC — put it in a client boundary or in `_app.tsx` / `layout.tsx` alongside the dynamic import.

## Usage

```html
<tc-button variant="primary">Save</tc-button>
<tc-alert variant="success" dismissible>Saved successfully.</tc-alert>
<tc-modal title="Confirm" id="confirm-modal">Are you sure?</tc-modal>
```

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
