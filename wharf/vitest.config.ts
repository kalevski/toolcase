import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Wharf's pure-domain units (server/domain/*.ts) are the only layer with tests
// (blueprint §domain). They import the shared contract via the `@/` alias, so the
// test runner needs the same alias the app uses. Run with `npm -w @toolcase/wharf test`.
const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
    resolve: {
        alias: { '@': root.replace(/\/$/, '') },
    },
    test: {
        include: ['server/**/*.test.ts'],
        environment: 'node',
    },
})
