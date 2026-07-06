// Pure git-SSH-key decisions — no I/O, no `server-only`, unit-testable in
// isolation (mirrors domain/account-secrets.ts). The private key MATERIAL never
// touches the database: services/git-keys.ts writes it to an owner-only file
// under `config.gitKeysDir` and everything else references the key by alias.

/** Kebab-case handle, 1–41 chars — same shape as account aliases. */
export const GIT_KEY_ALIAS_RE = /^[a-z0-9][a-z0-9-]{0,40}$/

/**
 * Loose shape check for pasted key material: a PEM/OpenSSH private key block
 * (`-----BEGIN OPENSSH PRIVATE KEY-----`, `-----BEGIN RSA PRIVATE KEY-----`, …).
 * Rejects public keys, tokens and arbitrary text before anything is written.
 */
export function looksLikePrivateKey(text: unknown): boolean {
    if (typeof text !== 'string') return false
    const t = text.trim()
    return /^-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(t) && /-----END [A-Z0-9 ]*PRIVATE KEY-----$/.test(t)
}

/**
 * Normalize pasted key material for the key file: CRLF → LF (a key pasted from
 * Windows otherwise breaks ssh) and exactly one trailing newline (OpenSSH
 * rejects a private key file without a final newline).
 */
export function normalizePrivateKey(text: string): string {
    return text.replace(/\r\n?/g, '\n').trim() + '\n'
}

/**
 * The `GIT_SSH_COMMAND` / `core.sshCommand` line for a saved key. Both are
 * parsed by `sh`, so paths are double-quoted. `IdentitiesOnly=yes` stops ssh
 * from offering unrelated ambient keys ahead of the selected one;
 * `StrictHostKeyChecking=accept-new` pins the host key into the app-managed
 * known_hosts on first contact instead of hanging on an interactive prompt.
 */
export function buildSshCommand(keyPath: string, knownHostsPath: string): string {
    return (
        `ssh -i "${keyPath}" -o IdentitiesOnly=yes ` +
        `-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="${knownHostsPath}"`
    )
}
