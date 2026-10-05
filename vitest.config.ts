import { defineConfig } from 'vitest/config'

// Root test runner. `npm test` runs every workspace's suites in one pass.
export default defineConfig({
    test: {
        include: ['**/*.test.ts'],
        // webmail/web tests use node:test (run via its own `npm test`), not vitest.
        exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**', 'webmail/web/**'],
        environment: 'node',
    },
})
