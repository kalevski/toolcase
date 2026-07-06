import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Root test runner. `npm test` runs every workspace's suites in one pass.
//
// Both Next.js apps (quaykeeper, taskforge) use the same `@/…` path alias
// internally (their tsconfig `paths`), so the alias must resolve PER APP —
// a single global `@/` mapping would load one app's `server/config` inside the
// other app's modules. Vitest projects scope the alias by test location.

// `server-only` throws when imported outside a Next bundler; its own no-op
// `empty.js` (the `react-server` export) lets server modules be unit-tested
// under plain Node. Inert for workspaces that never import it.
const serverOnlyShim = {
    find: /^server-only$/,
    replacement: fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
}

const appProject = (name: string) => ({
    resolve: {
        alias: [
            { find: /^@\//, replacement: fileURLToPath(new URL(`./${name}/`, import.meta.url)) },
            serverOnlyShim,
        ],
    },
    test: {
        name,
        include: [`${name}/**/*.test.ts`],
        exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**', '**/.workspace/**'],
        environment: 'node' as const,
    },
})

export default defineConfig({
    test: {
        projects: [
            appProject('quaykeeper'),
            appProject('taskforge'),
            // Library workspaces (base, logging, …) import relatively — no alias.
            {
                resolve: { alias: [serverOnlyShim] },
                test: {
                    name: 'packages',
                    include: ['**/*.test.ts'],
                    exclude: [
                        '**/node_modules/**',
                        '**/dist/**',
                        '**/lib/**',
                        '**/.workspace/**',
                        'quaykeeper/**',
                        'taskforge/**',
                    ],
                    environment: 'node' as const,
                },
            },
        ],
    },
})
