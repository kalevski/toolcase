# @toolcase/web-components

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/web-components?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/web-components)

**Framework-free** Bootstrap 5 components wrapped as HTML5 Web Components (`tc-*`). Drop them into plain HTML, React, Vue, Svelte, Angular, or any other stack — no framework required.

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

## Usage

```html
<tc-button variant="primary">Save</tc-button>
<tc-alert variant="success" dismissible>Saved successfully.</tc-alert>
<tc-modal title="Confirm" id="confirm-modal">Are you sure?</tc-modal>
```

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
