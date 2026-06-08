// File-backed role map (§4.3). Single Node process, so writes are serialized
// in-process and written atomically (temp file + rename).

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from './config'
import { ensureAuthDir } from './fs-workspace'
import type { Role, RolesFile, UserRecord } from './types'

function rolesPath(): string {
    return path.join(config.authDir, 'roles.json')
}

// in-process write serialization
let writeChain: Promise<void> = Promise.resolve()

async function readRolesFile(): Promise<RolesFile> {
    try {
        const raw = await fs.readFile(rolesPath(), 'utf8')
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.users)) return parsed as RolesFile
    } catch {
        /* missing or malformed → empty */
    }
    return { users: [] }
}

async function writeRolesFile(data: RolesFile): Promise<void> {
    await ensureAuthDir()
    const tmp = rolesPath() + `.tmp-${process.pid}`
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8')
    await fs.rename(tmp, rolesPath())
}

/** Serialize a read-modify-write against roles.json. */
function mutate<T>(fn: (data: RolesFile) => { data: RolesFile; result: T }): Promise<T> {
    const run = writeChain.then(async () => {
        const current = await readRolesFile()
        const { data, result } = fn(current)
        await writeRolesFile(data)
        return result
    })
    // keep the chain alive even if this mutation rejects
    writeChain = run.then(
        () => undefined,
        () => undefined,
    )
    return run
}

export async function listUsers(): Promise<UserRecord[]> {
    const { users } = await readRolesFile()
    return users
}

export async function getUser(githubId: number): Promise<UserRecord | undefined> {
    const { users } = await readRolesFile()
    return users.find((u) => u.githubId === githubId)
}

/** Authoritative role lookup, re-read from disk each call (§4.1 step 6). */
export async function getRole(githubId: number): Promise<Role | null> {
    const user = await getUser(githubId)
    return user ? user.role : null
}

function adminCount(users: UserRecord[]): number {
    return users.filter((u) => u.role === 'admin').length
}

export interface GithubProfile {
    githubId: number
    login: string
    name: string
    avatarUrl?: string
}

/**
 * Resolve (or create) a user on login. First user when no admin exists becomes
 * `admin` (bootstrap); every subsequent new user lands as `guest`. Returns the
 * resolved record (with its role).
 */
export async function resolveOnLogin(profile: GithubProfile): Promise<UserRecord> {
    return mutate((data) => {
        const existing = data.users.find((u) => u.githubId === profile.githubId)
        if (existing) {
            // keep role; refresh display fields
            existing.login = profile.login
            existing.name = profile.name
            existing.avatarUrl = profile.avatarUrl
            return { data, result: existing }
        }
        const role: Role = adminCount(data.users) === 0 ? 'admin' : 'guest'
        const record: UserRecord = {
            githubId: profile.githubId,
            login: profile.login,
            name: profile.name,
            avatarUrl: profile.avatarUrl,
            role,
            addedAt: new Date().toISOString(),
        }
        data.users.push(record)
        return { data, result: record }
    })
}

export class LastAdminError extends Error {}
export class UnknownUserError extends Error {}

/** Admin sets a user's role. Blocks demoting the last remaining admin (§4.3). */
export async function setRole(githubId: number, role: Role): Promise<UserRecord> {
    return mutate((data) => {
        const user = data.users.find((u) => u.githubId === githubId)
        if (!user) throw new UnknownUserError(`Unknown user ${githubId}`)
        if (user.role === 'admin' && role !== 'admin' && adminCount(data.users) === 1) {
            throw new LastAdminError('Cannot demote the last remaining admin')
        }
        user.role = role
        return { data, result: user }
    })
}
