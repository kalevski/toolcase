// Integration test for the role bootstrap (§4.3): first login ever becomes
// `owner`, subsequent logins land as `guest`, and the last owner can't be
// demoted. Boots the real stack: env BEFORE dynamic import (config reads env at
// import time), temp SQLite DB, real migrations.

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeAll } from 'vitest'

const work = mkdtempSync(path.join(tmpdir(), 'taskforge-roles-'))
process.env.TASKFORGE_DB_PATH = path.join(work, 'test.db')
process.env.WORKSPACE_DIR = work
process.env.TASKFORGE_GITHUB_CLIENT_ID = 'test'
process.env.TASKFORGE_GITHUB_CLIENT_SECRET = 'test'
process.env.TASKFORGE_OAUTH_REDIRECT_URI = 'http://localhost:3000/api/auth/github/callback'
process.env.TASKFORGE_AUTH_SECRET = 'x'.repeat(32)

let roles: typeof import('../server/services/roles')

beforeAll(async () => {
    const db = await import('../server/data/db')
    db.initDb()
    roles = await import('../server/services/roles')
})

describe('role bootstrap', () => {
    it('first login becomes owner', async () => {
        const first = await roles.resolveOnLogin({ githubId: 1, login: 'first', name: 'First User' })
        expect(first.role).toBe('owner')
    })

    it('subsequent logins land as guest', async () => {
        const second = await roles.resolveOnLogin({ githubId: 2, login: 'second', name: 'Second User' })
        expect(second.role).toBe('guest')
    })

    it('re-login keeps the existing role, refreshes the profile', async () => {
        const again = await roles.resolveOnLogin({ githubId: 1, login: 'first-renamed', name: 'First User' })
        expect(again.role).toBe('owner')
        expect(again.login).toBe('first-renamed')
    })

    it('promoting and demoting works, but never the last owner', async () => {
        const promoted = await roles.setRole(2, 'standard')
        expect(promoted.role).toBe('standard')
        // user 1 is the only owner — demoting them must throw
        await expect(roles.setRole(1, 'standard')).rejects.toBeInstanceOf(roles.LastOwnerError)
        // add a second owner, then the demotion of user 1 is allowed
        await roles.setRole(2, 'owner')
        const demoted = await roles.setRole(1, 'guest')
        expect(demoted.role).toBe('guest')
    })

    it('unknown user throws UnknownUserError', async () => {
        await expect(roles.setRole(999, 'guest')).rejects.toBeInstanceOf(roles.UnknownUserError)
    })
})
