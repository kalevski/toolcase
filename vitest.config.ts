import { defineConfig } from 'vitest/config'

// Root test runner. `npm test` runs every workspace's suites in one pass.
//
// perch and wharf are Next.js apps whose domain tests import the shared contract
// via the `@/` path alias, which only resolves against each app's own root. They
// therefore run as separate projects that load their package-local vitest config
// (where the alias is wired). Every other workspace uses relative imports, so it
// runs under the single `core` project below — which excludes the two aliased apps
// so their suites aren't picked up here without the alias and fail.
export default defineConfig({
    test: {
        projects: [
            './perch/vitest.config.ts',
            './wharf/vitest.config.ts',
            {
                extends: false,
                test: {
                    name: 'core',
                    include: ['**/*.test.ts'],
                    exclude: [
                        '**/node_modules/**',
                        '**/dist/**',
                        '**/lib/**',
                        '**/.workspace/**',
                        'perch/**',
                        'wharf/**',
                    ],
                    environment: 'node',
                },
            },
        ],
    },
})
