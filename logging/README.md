# @toolcase/logging


[![GitHub](https://img.shields.io/github/license/rivalis/rivalis?style=for-the-badge)](https://github.com/rivalis/rivalis/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/logging?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/logging)
[![npm downloads](https://img.shields.io/npm/dw/@toolcase/logging?label=downloads&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/logging)
[![Read docs](https://img.shields.io/badge/READ-DOCS-green?style=for-the-badge)](https://kalevski.dev/toolcase)

🏷 Lightweight logger for NodeJS and Browser

## ⭐ Features

- 👌Lightweight (3.1 kb)
- 🔌Can be extended with additional reporters
- 🌐 Supports logging scope

## 🚀 Getting started

```js
npm install --save @toolcase/logging
```

```js
import logging from '@toolcase/logging'

const myLogger = logging.getLogger('[scope]')

myLogger.info('Hello world!')

```
----

## License
The project is licensed under [MIT License](https://github.com/kalevski/toolcase/blob/main/LICENSE)