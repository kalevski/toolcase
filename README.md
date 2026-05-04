# toolcase 🧰

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)

A monorepo of focused, framework-light TypeScript packages for building modern web, Node.js, and HTML5 game projects.

Every package is **TypeScript-first**, ships **dual ESM + CJS** (where applicable), is **tree-shakeable**, and targets **Node.js ≥ 18**. Core packages have **zero runtime dependencies**.

📖 Live docs and demos: **[toolcase.kalevski.dev](https://toolcase.kalevski.dev)**

## 📦 Packages

| Package | Version | What it gives you |
|---------|---------|-------------------|
| 🧬 [`@toolcase/base`](./base) | [![v](https://img.shields.io/npm/v/@toolcase/base?label=&color=teal)](https://www.npmjs.com/package/@toolcase/base) | Zero-dep helpers and data structures (Cache, PriorityQueue, ObjectPool, State, EventEmitter, retry, JSONSchema, …). |
| 🏷 [`@toolcase/logging`](./logging) | [![v](https://img.shields.io/npm/v/@toolcase/logging?label=&color=teal)](https://www.npmjs.com/package/@toolcase/logging) | Tiny isomorphic logger with scoped loggers, log levels, and pluggable reporters. |
| 📦 [`@toolcase/serializer`](./serializer) | [![v](https://img.shields.io/npm/v/@toolcase/serializer?label=&color=teal)](https://www.npmjs.com/package/@toolcase/serializer) | Runtime protobuf-based binary serializer — define schemas in code, encode/decode `Uint8Array`. |
| 🧩 [`@toolcase/react-components`](./react-components) | [![v](https://img.shields.io/npm/v/@toolcase/react-components?label=&color=teal)](https://www.npmjs.com/package/@toolcase/react-components) | Production React 18+ component library — layout, forms, data display, modals, file upload, advanced editors. |
| 🎮 [`@toolcase/game-components`](./game-components) | [![v](https://img.shields.io/npm/v/@toolcase/game-components?label=&color=teal)](https://www.npmjs.com/package/@toolcase/game-components) | Framework-free Web Components for game UIs (HUDs, dialogs, inventories) — vanilla HTML5 + Shadow DOM. |
| 🕹 [`@toolcase/phaser-plus`](./phaser-plus) | [![v](https://img.shields.io/npm/v/@toolcase/phaser-plus?label=&color=teal)](https://www.npmjs.com/package/@toolcase/phaser-plus) | Opinionated runtime for Phaser 4 — scene lifecycle, feature registry, object pool, flow events, isometric, shader effects, A*, Tweakpane debugger. |

## Pick a package

- **Need helpers?** → `@toolcase/base` (works in browser + Node).
- **Need logs?** → `@toolcase/logging` (browser console + custom reporters).
- **Sending binary data over the wire?** → `@toolcase/serializer` (protobuf, no `.proto` files).
- **Building a React app?** → `@toolcase/react-components` (Bootstrap 5 base, BEM theming).
- **Building a game UI without a framework?** → `@toolcase/game-components` (drop-in Web Components).
- **Building a Phaser 4 game?** → `@toolcase/phaser-plus` (runtime layer with batteries included).

## Install

Each package ships independently. Install only what you need:

```bash
npm install @toolcase/base
npm install @toolcase/logging
npm install @toolcase/serializer
npm install @toolcase/react-components
npm install @toolcase/game-components
npm install @toolcase/phaser-plus phaser
```

## Quick example

```ts
import logging from '@toolcase/logging'
import { retry, Cache } from '@toolcase/base'

const log = logging.getLogger('users')
const cache = new Cache<User>(60_000) // 60s TTL

async function getUser(id: string) {
    const cached = cache.get(id)
    if (cached) return cached

    const user = await retry(() => fetchUser(id), { retries: 3 })
    cache.set(id, user)
    log.info('fetched user', id)
    return user
}
```

## Claude Code skills

Each package publishes a [Claude Code](https://claude.com/claude-code) skill at `toolcase.kalevski.dev/<package>/SKILL.md`. Install one with:

```bash
claude /skill-install https://toolcase.kalevski.dev/base/SKILL.md
claude /skill-install https://toolcase.kalevski.dev/react-components/SKILL.md
# … etc
```

## Development

This repo is an npm workspaces monorepo.

```bash
npm install            # install all workspace deps
npm run build          # build every package
npm test               # vitest, all workspaces
npm run lint           # eslint .
npm run lint:exports   # publint each package's export map
npm run format         # prettier --write .
```

Per-package commands:

```bash
npm -w @toolcase/base run dev               # tsup --watch
npm -w @toolcase/react-components run build # JS + SCSS bundle
npm -w @toolcase/phaser-plus run typecheck  # tsc --noEmit
npm -w @toolcase/examples run dev           # demo site (Vite)
```

Run a single test file:

```bash
npx vitest run path/to/file.test.ts
```

## Repo layout

```
base/               @toolcase/base
logging/            @toolcase/logging
serializer/         @toolcase/serializer
react-components/   @toolcase/react-components
game-components/    @toolcase/game-components
phaser-plus/        @toolcase/phaser-plus
examples/           Vite + React demo site (deployed to GH Pages)
```

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE) — © Daniel Kalevski
