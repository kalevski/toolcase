import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Driver contract suite (perch_database_management.md §12) — NOT part of the
// default `npm test` run: it needs live database servers. Start them, export the
// URLs, and run `npm run test:drivers`:
//
//   docker run --rm -d -p 5433:5432 -e POSTGRES_PASSWORD=contract postgres:16
//   docker run --rm -d -p 3307:3306 -e MYSQL_ROOT_PASSWORD=contract mysql:8
//   PERCH_CONTRACT_PG=postgres://postgres:contract@127.0.0.1:5433 \
//   PERCH_CONTRACT_MYSQL=mysql://root:contract@127.0.0.1:3307 \
//   npm run test:drivers
//
// Either env var may be omitted — that engine's suite skips. The `server-only`
// marker package is aliased to an empty stub so the driver modules load under
// plain Node (the marker exists to fail client bundles, not test runners).
const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
    resolve: {
        alias: {
            '@': root.replace(/\/$/, ''),
            'server-only': `${root}scripts/server-only-stub.ts`,
        },
    },
    test: {
        include: ['server/infrastructure/db-drivers/*.contract.ts'],
        environment: 'node',
        // Live servers + real DDL — generous ceilings, sequential by design.
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
})
