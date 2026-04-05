# @toolcase/examples

Interactive demo app showcasing `@toolcase/base` and `@toolcase/react-components`.

Deployed at [kalevski.dev/toolcase](https://kalevski.dev/toolcase).

## Development

```bash
# From the monorepo root
npm install
npm run build          # build all packages first
cd examples
npm run dev            # start Vite dev server
```

## Examples

| Route | Description |
|-------|-------------|
| `/` | Home page with links to all sections |
| `/base` | `@toolcase/base` utilities — AdjacencyMatrix, State, Cache, retry, JSONSchema, env, Serializer |
| `/react-components` | Component showcase for all `@toolcase/react-components` exports |
| `/react-components/:key` | Individual component demo pages |
