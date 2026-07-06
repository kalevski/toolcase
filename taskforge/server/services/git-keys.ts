// Saved git SSH keys (deploy keys) — the secret boundary for SSH clones.
// This module owns the key material: `saveKey` writes the pasted private key to
// an owner-only file at `${config.gitKeysDir}/<alias>` (dir 0700, file 0600)
// and only registry metadata (alias/label/created_at) reaches the `git_key`
// table. The key value is never returned by any API — write-only on create.
// `sshCommandFor` resolves an alias to the `GIT_SSH_COMMAND` line the git layer
// injects for the clone and persists into the repo's `core.sshCommand`.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import * as gitKeyRepo from '@/server/data/repositories/git-key-repo'
import { InvalidGitKeyError } from '@/server/data/repositories/git-key-repo'
import { listProjectsUsingSshKey } from '@/server/data/repositories/project-repo'
import { looksLikePrivateKey, normalizePrivateKey, buildSshCommand } from '@/server/domain/git-keys'
import { slog } from '@/server/infrastructure/server-log'
import type { GitKey } from '@/server/domain/types'

// Key files are real secrets (equivalent to the OAuth `.credentials.json` in
// the accounts tree) — dir owner-only, each key file owner-read/write only.
const KEYS_DIR_MODE = 0o700
const KEY_FILE_MODE = 0o600

/** Attempt to save an alias that is already in the registry. */
export class GitKeyExistsError extends Error {
    constructor(alias: string) {
        super(`SSH key "${alias}" already exists`)
    }
}

/** Unknown alias passed to `sshCommandFor` / clone. */
export class UnknownGitKeyError extends Error {
    constructor(alias: string, detail = 'unknown SSH key') {
        super(`${detail}: "${alias}"`)
    }
}

/** Refusal to delete a key that projects were cloned with. */
export class GitKeyInUseError extends Error {
    constructor(alias: string, projects: string[]) {
        super(`SSH key "${alias}" is used by project${projects.length > 1 ? 's' : ''}: ${projects.join(', ')}`)
    }
}

function keyPath(alias: string): string {
    return path.join(config.gitKeysDir, alias)
}

function knownHostsPath(): string {
    return path.join(config.gitKeysDir, 'known_hosts')
}

/** Create `dir` and pin it owner-only (mkdir's mode is umask-masked → chmod). */
async function mkdirSecure(dir: string): Promise<void> {
    await fs.mkdir(dir, { recursive: true, mode: KEYS_DIR_MODE })
    await fs.chmod(dir, KEYS_DIR_MODE)
}

/**
 * Boot-time hardening for the keys tree (mirrors `ensureAccountsDirSecure`):
 * ensure `gitKeysDir` exists at 0700 and repair every key file to 0600.
 * Best-effort — a permissions hiccup never blocks startup.
 */
export async function ensureGitKeysDirSecure(): Promise<void> {
    try {
        await mkdirSecure(config.gitKeysDir)
        const entries = await fs.readdir(config.gitKeysDir, { withFileTypes: true })
        for (const entry of entries) {
            if (entry.isFile()) {
                await fs.chmod(path.join(config.gitKeysDir, entry.name), KEY_FILE_MODE).catch(() => {})
            }
        }
    } catch (err: any) {
        slog('warn', 'git-keys', 'could not harden git keys dir permissions', {
            dir: config.gitKeysDir,
            error: err?.message ?? String(err),
        })
    }
}

/** All saved keys (alias-sorted). Metadata only — never key material. */
export function listKeys(): GitKey[] {
    return gitKeyRepo.list()
}

export interface SaveKeyInput {
    alias: string
    label?: string
    /** The private key material — written to disk once, never persisted elsewhere. */
    privateKey: string
}

/**
 * Save a new key: validate the alias + key shape, reject a duplicate, write the
 * key file owner-only, then persist the registry row. The file is written first
 * and removed again if the row insert fails, so a half-saved key never lingers.
 */
export async function saveKey({ alias, label, privateKey }: SaveKeyInput): Promise<GitKey> {
    gitKeyRepo.validateAlias(alias)
    if (!looksLikePrivateKey(privateKey)) {
        throw new InvalidGitKeyError(
            'privateKey must be a PEM/OpenSSH private key block (-----BEGIN … PRIVATE KEY-----)',
        )
    }
    if (gitKeyRepo.get(alias)) throw new GitKeyExistsError(alias)

    await mkdirSecure(config.gitKeysDir)
    const file = keyPath(alias)
    // writeFile's mode is umask-masked like mkdir's — chmod pins the exact mode.
    await fs.writeFile(file, normalizePrivateKey(privateKey), { mode: KEY_FILE_MODE })
    await fs.chmod(file, KEY_FILE_MODE)
    try {
        return gitKeyRepo.insert(alias, label, new Date().toISOString())
    } catch (err) {
        await fs.rm(file, { force: true }).catch(() => {})
        throw err
    }
}

/**
 * Remove a saved key (registry row + key file). Returns false for an unknown
 * alias (caller 404s). Refuses while any project still references the key —
 * its repo's `core.sshCommand` points at the file, so deleting it would break
 * that project's fetch/pull/push.
 */
export async function removeKey(alias: string): Promise<boolean> {
    if (!gitKeyRepo.get(alias)) return false
    const projects = listProjectsUsingSshKey(alias)
    if (projects.length > 0) throw new GitKeyInUseError(alias, projects)
    gitKeyRepo.remove(alias)
    await fs.rm(keyPath(alias), { force: true }).catch(() => {})
    return true
}

/**
 * Resolve a saved key alias to the ssh command line git should run
 * (`GIT_SSH_COMMAND` for the clone, `core.sshCommand` thereafter). Throws
 * `UnknownGitKeyError` for an unregistered alias or a registry row whose key
 * file has gone missing on disk.
 */
export async function sshCommandFor(alias: string): Promise<string> {
    if (!gitKeyRepo.get(alias)) throw new UnknownGitKeyError(alias)
    const file = keyPath(alias)
    try {
        await fs.access(file)
    } catch {
        throw new UnknownGitKeyError(alias, 'SSH key file missing on disk')
    }
    return buildSshCommand(file, knownHostsPath())
}
