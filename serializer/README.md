# @toolcase/serializer

Protobuf-based binary serializer built on top of [protobufjs](https://github.com/protobufjs/protobuf.js).

## Install

```bash
npm install @toolcase/serializer
```

## Usage

```ts
import Serializer from '@toolcase/serializer'

const serializer = new Serializer()

serializer.define('Player', [
    { key: 'name', type: Serializer.FieldType.STRING, rule: 'required' },
    { key: 'score', type: Serializer.FieldType.INT32, rule: 'optional', default: 0 }
])

const buffer = serializer.encode('Player', { name: 'Alice', score: 42 })
const decoded = serializer.decode('Player', buffer)
```

## License

MIT
