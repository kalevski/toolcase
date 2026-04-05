# toolcase 🧰

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)

Collection of TypeScript modules useful for building Web and Node.js applications. Zero dependencies in core packages, tree-shakeable ESM + CJS dual output.

## 📦 Packages

| Package | Description |
|---------|-------------|
| 🧬 [**@toolcase/base**](https://github.com/kalevski/toolcase/tree/main/base) | Helper functions and data structures (zero deps) |
| 🏷 [**@toolcase/logging**](https://github.com/kalevski/toolcase/tree/main/logging) | Lightweight logger for Node.js and Browser (zero deps) |
| 📦 [**@toolcase/serializer**](https://github.com/kalevski/toolcase/tree/main/serializer) | Protobuf-based binary serializer |
| 🧩 [**@toolcase/react-components**](https://github.com/kalevski/toolcase/tree/main/react-components) | React component library (layout, forms, data display, and more) |

## Getting Started

```bash
# Install individual packages
npm install @toolcase/base
npm install @toolcase/logging
npm install @toolcase/serializer
npm install @toolcase/react-components
```

## Development

```bash
npm install        # install all workspace dependencies
npm run build      # build all packages
npm test           # run all tests
npm run lint       # lint all packages
```

## License

The project is licensed under [MIT License](https://github.com/kalevski/toolcase/blob/main/LICENSE)