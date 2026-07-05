import { defineConfig } from 'vitest/config'

// Root test runner. `npm test` runs every workspace's suites in one pass.
export default defineConfig({
    test: {
        include: ['**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**', '**/.workspace/**'],
        environment: 'node',
    },
})
