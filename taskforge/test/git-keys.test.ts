// Pure git-SSH-key decisions (server/domain/git-keys.ts) — key-shape
// validation, key-file normalization and the GIT_SSH_COMMAND builder.

import { describe, it, expect } from 'vitest'
import {
    GIT_KEY_ALIAS_RE,
    looksLikePrivateKey,
    normalizePrivateKey,
    buildSshCommand,
} from '@/server/domain/git-keys'

const OPENSSH_KEY = '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXk=\n-----END OPENSSH PRIVATE KEY-----'
const RSA_KEY = '-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----'

describe('GIT_KEY_ALIAS_RE', () => {
    it('accepts kebab-case handles', () => {
        expect(GIT_KEY_ALIAS_RE.test('deploy-backend')).toBe(true)
        expect(GIT_KEY_ALIAS_RE.test('k1')).toBe(true)
    })

    it('rejects uppercase, leading dash, spaces and traversal shapes', () => {
        expect(GIT_KEY_ALIAS_RE.test('Deploy')).toBe(false)
        expect(GIT_KEY_ALIAS_RE.test('-lead')).toBe(false)
        expect(GIT_KEY_ALIAS_RE.test('a b')).toBe(false)
        expect(GIT_KEY_ALIAS_RE.test('../etc')).toBe(false)
        expect(GIT_KEY_ALIAS_RE.test('')).toBe(false)
    })
})

describe('looksLikePrivateKey', () => {
    it('accepts OpenSSH and PEM private key blocks (with surrounding whitespace)', () => {
        expect(looksLikePrivateKey(OPENSSH_KEY)).toBe(true)
        expect(looksLikePrivateKey(`\n  ${RSA_KEY}\n`)).toBe(true)
    })

    it('rejects public keys, tokens and non-strings', () => {
        expect(looksLikePrivateKey('ssh-ed25519 AAAAC3Nza user@host')).toBe(false)
        expect(looksLikePrivateKey('ghp_abc123')).toBe(false)
        expect(looksLikePrivateKey('-----BEGIN CERTIFICATE-----\nx\n-----END CERTIFICATE-----')).toBe(false)
        // Truncated paste — no END marker.
        expect(looksLikePrivateKey('-----BEGIN OPENSSH PRIVATE KEY-----\nb3Blbg==')).toBe(false)
        expect(looksLikePrivateKey(undefined)).toBe(false)
        expect(looksLikePrivateKey(42)).toBe(false)
    })
})

describe('normalizePrivateKey', () => {
    it('converts CRLF/CR to LF and guarantees exactly one trailing newline', () => {
        expect(normalizePrivateKey('a\r\nb\r\n')).toBe('a\nb\n')
        expect(normalizePrivateKey('a\rb')).toBe('a\nb\n')
        expect(normalizePrivateKey(`${OPENSSH_KEY}\n\n\n`)).toBe(`${OPENSSH_KEY}\n`)
        expect(normalizePrivateKey(OPENSSH_KEY)).toBe(`${OPENSSH_KEY}\n`)
    })
})

describe('buildSshCommand', () => {
    it('quotes both paths and pins non-interactive host-key handling', () => {
        const cmd = buildSshCommand('/ws/.git-ssh-keys/deploy a', '/ws/.git-ssh-keys/known_hosts')
        expect(cmd).toBe(
            'ssh -i "/ws/.git-ssh-keys/deploy a" -o IdentitiesOnly=yes ' +
                '-o StrictHostKeyChecking=accept-new -o UserKnownHostsFile="/ws/.git-ssh-keys/known_hosts"',
        )
    })
})
