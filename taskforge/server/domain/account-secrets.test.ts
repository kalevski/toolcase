// Unit coverage for the secret-hygiene boundary that keeps API keys out of the
// registry, logs, audit detail, and telemetry. Pure — no SQLite, no fs — so it
// pins the redaction/detection rules directly.

import { describe, it, expect } from 'vitest'
import { looksLikeApiKey, scrubSecrets, REDACTED } from './account-secrets'

describe('looksLikeApiKey', () => {
    it('rejects env-var names (the legitimate apiKeyEnv values)', () => {
        expect(looksLikeApiKey('TASKFORGE_CIBOT_KEY')).toBe(false)
        expect(looksLikeApiKey('ANTHROPIC_API_KEY')).toBe(false)
        expect(looksLikeApiKey(undefined)).toBe(false)
        expect(looksLikeApiKey('')).toBe(false)
        expect(looksLikeApiKey(null)).toBe(false)
    })

    it('flags an actual key value pasted where a name belongs', () => {
        expect(looksLikeApiKey('sk-ant-api03-AbCdEf123')).toBe(true)
        // Leading/trailing whitespace must not slip a key past the guard.
        expect(looksLikeApiKey('  sk-ant-oat01-xyz  ')).toBe(true)
    })
})

describe('scrubSecrets', () => {
    it('redacts an explicitly supplied key value and config dir', () => {
        const key = 'sk-ant-api03-SECRETVALUE123'
        const dir = '/workspace/.claude-accounts/alpha'
        const text = `spawn failed: ANTHROPIC_API_KEY=${key} CLAUDE_CONFIG_DIR=${dir}`
        const out = scrubSecrets(text, [key, dir])
        expect(out).not.toContain(key)
        expect(out).not.toContain(dir)
        expect(out).toContain(REDACTED)
    })

    it('catches a stray sk-ant- token even when not supplied explicitly', () => {
        const out = scrubSecrets('error: invalid api key sk-ant-oat01-leakedToken')
        expect(out).not.toContain('sk-ant-oat01-leakedToken')
        expect(out).toContain(REDACTED)
    })

    it('ignores empty/trivial secrets so it never blanks the whole string', () => {
        expect(scrubSecrets('all good', ['', undefined, 'a'])).toBe('all good')
    })

    it('returns text unchanged when there is nothing to redact', () => {
        expect(scrubSecrets('account alpha verified ok', ['sk-ant-unused'])).toBe(
            'account alpha verified ok',
        )
    })
})
