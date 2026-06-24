// Secret-hygiene helpers for the multi-account registry. Pure (no `server-only`,
// no fs/db imports) so they run in any context and are unit-testable directly.
//
// SECRET INVARIANT: an account's API **key value** is never stored in the
// `account` table, never returned by any account API/service, and never written
// to a run log, audit detail, or telemetry. The registry stores only the env-var
// *name* (`apiKeyEnv`) that references the key; the value is read from
// `process.env[apiKeyEnv]` at spawn time and discarded. These helpers enforce
// that boundary at two points:
//   1. `looksLikeApiKey` — reject a key value mistakenly supplied where an
//      env-var *name* is expected, so a secret can never land in the table.
//   2. `scrubSecrets` — redact resolved key values and config-dir paths out of
//      any diagnostic text before it reaches a log / audit row / telemetry.

/** Replacement marker for a redacted secret. */
export const REDACTED = '«redacted»'

// Anthropic API keys (and `ANTHROPIC_AUTH_TOKEN` gateway tokens) carry this
// sentinel prefix; the rest is an opaque base62/`-`/`_` blob. Used both to
// detect a key passed where a name belongs and to catch a stray key in text.
const API_KEY_PREFIX = /^sk-ant-/
const API_KEY_RE = /sk-ant-[A-Za-z0-9_-]+/g

/**
 * True when `value` looks like a real API **key** rather than an env-var *name*.
 * `apiKeyEnv` must be the *name* of the env var that holds the key (e.g.
 * `TASKFORGE_CIBOT_KEY`); if an operator pastes the actual `sk-ant-…` secret
 * here, persisting it would leak the key into the registry. Callers reject such
 * input before it is written.
 */
export function looksLikeApiKey(value: string | undefined | null): boolean {
    return !!value && API_KEY_PREFIX.test(value.trim())
}

/**
 * Redact secrets from diagnostic text before it is logged / audited / stored.
 * Removes any explicitly-supplied `secrets` (typically the resolved
 * `ANTHROPIC_API_KEY` value and the account's `CLAUDE_CONFIG_DIR` path) by
 * literal substring match, then catches any stray `sk-ant-…` token by pattern.
 * Short/empty secrets are ignored so a 1–2 char value can't blank the whole
 * string. Returns the text unchanged when nothing matches.
 */
export function scrubSecrets(text: string, secrets: Iterable<string | undefined> = []): string {
    let out = text
    for (const s of secrets) {
        // Guard against empty/trivial values that would over-redact.
        if (!s || s.length < 4) continue
        out = out.split(s).join(REDACTED)
    }
    return out.replace(API_KEY_RE, REDACTED)
}
