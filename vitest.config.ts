import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Root test runner. `npm test` runs every workspace's suites in one pass.
export default defineConfig({
    // Quaykeeper's source uses the `@/…` path alias (its tsconfig `paths`). Other
    // workspaces import relatively, so a regex-scoped `^@/` alias lets Quaykeeper's
    // unit tests resolve without touching `@toolcase/*` package specifiers.
    resolve: {
        alias: [
            { find: /^@\//, replacement: fileURLToPath(new URL('./quaykeeper/', import.meta.url)) },
            // `server-only` throws when imported outside a Next bundler; its own
            // no-op `empty.js` (the `react-server` export) lets server modules be
            // unit-tested under plain Node. Inert for workspaces that never import it.
            { find: /^server-only$/, replacement: fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)) },
        ],
    },
    test: {
        include: ['**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**', '**/.workspace/**'],
        environment: 'node',
    },
})
