# @toolcase/game-components

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/game-components?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/game-components)

Game UI component library built with native HTML5 Web Components. No frameworks, no runtime libraries — only standard browser APIs (`HTMLElement`, `customElements`, Shadow DOM).

## Install

```bash
npm install @toolcase/game-components
```

### Peer Dependencies

- `@toolcase/base` 2.x

### Import Styles

```ts
import '@toolcase/game-components/style.css'
```

### Use a Component

```ts
import '@toolcase/game-components'

document.body.innerHTML = `<tc-hello-world name="Player"></tc-hello-world>`
```

## Components

| Component | Tag | Description |
|-----------|-----|-------------|
| `HelloWorld` | `tc-hello-world` | Minimal greeting element. Accepts `name` attribute. |

## Styling

Styles are built with SCSS. Import the bundled CSS:

```ts
import '@toolcase/game-components/style.css'
```

Component class names are namespaced (`component component-<name>`) and can be overridden via CSS variables or SCSS overrides before importing.

## License

The project is licensed under [MIT License](https://github.com/kalevski/toolcase/blob/main/LICENSE)
