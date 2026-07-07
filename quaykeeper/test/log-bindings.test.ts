import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// Exercises setRealmBinding's daemon-write ordering (bug 6: switching a realm's
// destination used to retract + delete the OLD binding before confirming the
// daemon accepted the NEW fragment, so a rejection left the realm with no log
// shipping at all). Real sqlite DB + repos (same pattern as
// jobs-exec.integration.test.ts); only the nginxpilot client is faked, since a
// real one would make network calls.

vi.mock('@/server/services/realms', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/server/services/realms')>()
    return { ...actual, clientFor: vi.fn() }
})

let logBindings: typeof import('@/server/services/log-bindings')
let realmRepo: typeof import('@/server/data/repositories/realm-repo')
let logDestRepo: typeof import('@/server/data/repositories/log-destination-repo')
let logBindingRepo: typeof import('@/server/data/repositories/log-binding-repo')
let realms: typeof import('@/server/services/realms')

const ACTOR = { githubId: 1, login: 'tester' }
const REALM_ID = 'realm_test'

function fakeClient(overrides: Partial<Record<'writeLogDestination' | 'removeLogDestination', (...args: unknown[]) => unknown>> = {}) {
    return {
        writeLogDestination: vi.fn().mockResolvedValue(undefined),
        removeLogDestination: vi.fn().mockResolvedValue(undefined),
        listLogDestinations: vi.fn().mockResolvedValue([]),
        ...overrides,
    }
}

beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'qk-log-bindings-test-'))
    process.env.QUAYKEEPER_DB_PATH = path.join(dir, 'test.db')
    process.env.QUAYKEEPER_GITHUB_CLIENT_ID = 'test'
    process.env.QUAYKEEPER_GITHUB_CLIENT_SECRET = 'test'
    process.env.QUAYKEEPER_OAUTH_REDIRECT_URI = 'http://localhost/cb'
    process.env.QUAYKEEPER_AUTH_SECRET = 'x'.repeat(48)
    const db = await import('@/server/data/db')
    db.initDb()

    realmRepo = await import('@/server/data/repositories/realm-repo')
    logDestRepo = await import('@/server/data/repositories/log-destination-repo')
    logBindingRepo = await import('@/server/data/repositories/log-binding-repo')
    logBindings = await import('@/server/services/log-bindings')
    realms = await import('@/server/services/realms')

    realmRepo.create({ id: REALM_ID, name: 'test-realm', adminUrl: 'https://nginxpilot.example.com', isDefault: true, createdAt: new Date().toISOString() }, null)
})

function insertDest(id: string, name: string) {
    logDestRepo.insert({
        id,
        name,
        type: 'http',
        spec: { name, type: 'http', url: 'https://collector.example.com/x' },
        createdBy: ACTOR.githubId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    })
}

describe('setRealmBinding', () => {
    it('rejects the switch and leaves the old binding untouched when the daemon refuses the new fragment (bug 6)', async () => {
        insertDest('dest_a', 'dest-a')
        insertDest('dest_b', 'dest-b')

        const clientA = fakeClient()
        vi.mocked(realms.clientFor).mockReturnValue(clientA as unknown as ReturnType<typeof realms.clientFor>)
        const first = await logBindings.setRealmBinding(ACTOR, REALM_ID, { destinationId: 'dest_a', enabled: true, shaping: {} })
        expect(clientA.writeLogDestination).toHaveBeenCalledTimes(1)

        const clientB = fakeClient({ writeLogDestination: vi.fn().mockRejectedValue(new Error('daemon rejected')) })
        vi.mocked(realms.clientFor).mockReturnValue(clientB as unknown as ReturnType<typeof realms.clientFor>)

        await expect(
            logBindings.setRealmBinding(ACTOR, REALM_ID, { destinationId: 'dest_b', enabled: true, shaping: {} }),
        ).rejects.toThrow('daemon rejected')

        // The old binding (dest-a) must still exist — never retracted or deleted.
        const stillThere = logBindingRepo.byId(first.id)
        expect(stillThere).toBeDefined()
        expect(stillThere?.destinationId).toBe('dest_a')
        expect(clientB.removeLogDestination).not.toHaveBeenCalled()

        // No row for the rejected destination either.
        const rows = logBindingRepo.listRealm(REALM_ID)
        expect(rows).toHaveLength(1)
        expect(rows[0].destinationId).toBe('dest_a')
    })

    it('switches cleanly when the daemon accepts the new fragment', async () => {
        insertDest('dest_c', 'dest-c')
        insertDest('dest_d', 'dest-d')

        const client1 = fakeClient()
        vi.mocked(realms.clientFor).mockReturnValue(client1 as unknown as ReturnType<typeof realms.clientFor>)
        await logBindings.setRealmBinding(ACTOR, REALM_ID, { destinationId: 'dest_c', enabled: true, shaping: {} })

        const client2 = fakeClient()
        vi.mocked(realms.clientFor).mockReturnValue(client2 as unknown as ReturnType<typeof realms.clientFor>)
        const second = await logBindings.setRealmBinding(ACTOR, REALM_ID, { destinationId: 'dest_d', enabled: true, shaping: {} })

        expect(client2.writeLogDestination).toHaveBeenCalledTimes(1)
        expect(client2.removeLogDestination).toHaveBeenCalledWith('dest-c')

        const rows = logBindingRepo.listRealm(REALM_ID).filter((r) => r.destinationId === 'dest_c' || r.destinationId === 'dest_d')
        expect(rows.map((r) => r.destinationId)).toEqual(['dest_d'])
        expect(second.destinationId).toBe('dest_d')
    })
})
