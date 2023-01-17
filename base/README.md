# @toolcase/base

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/base?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/base)
[![npm downloads](https://img.shields.io/npm/dw/@toolcase/base?label=downloads&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/base)

🧬 Collection of JavaScript helper functions and structures

## ⭐ Features

- **VectorClock** - Vector clock data structure used for synchronization in distributed systems
- **EventEmitter** - fast implementation of EventEmitter compatible with NodeJS & Browser
- **Broadcast** - utility used for providing broadcasting interface on top of EventEmitter
- **LSystem** - Lindenmayer system structure used for modeling the morphology of a variety of organisms.
- **ObjectPool** - Creational design pattern for reusing object instances and save GC time.
- **PriorityQueue** - Ordered queue data structure.
- **env(key, defaultValue, type)** - NodeJS helper function for reading environment variable
- **generateId(length)** - function for generating unique identifier
- **toHex(value)** - function for converting number to hexadecimal string
- **bufferToHex(buffer)** - function for converting Uint8Array to hexadecimal string
- **hextToBuffer(hex)** - function for converting hexadecimal string to Uint8Array
- **Color** - Material design color palette
- **formatByteSize** - Format byte size to human readable string
- **JSONSchema** - Schema is extensible structure for validating JSON objects. 


## 🚀 Getting started

```js
npm install --save @toolcase/base
```

## License
The project is licensed under [MIT License](https://github.com/kalevski/toolcase/blob/main/LICENSE)