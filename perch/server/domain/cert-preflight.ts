// Pure classifier for the cert-issuance pre-flight (perch_better.md B2, the
// control-plane counterpart of NPM's `testHttpsChallenge`). The service gathers the
// raw signals — DNS records, the configured ingress IPs, an HTTP-01 path probe —
// and this decides the single verdict the UI renders. Advisory only: it gates
// nothing, it just saves rate-limited ACME attempts that were never going to pass.

/** The raw signals `services/certs.preflight` gathers for one domain. */
export interface CertPreflightSignals {
    /** Every A/AAAA record the domain resolved to (empty = no DNS). */
    resolved: readonly string[]
    /** The ingress IPs this deployment fronts (v4 + optional v6); empty = unknown. */
    ingress: readonly string[]
    /**
     * Outcome of probing `http://<domain>/.well-known/acme-challenge/<nonce>`:
     * `reachable` = ANY http response came back (a webroot 404 is the healthy case —
     * the path is routable), `unreachable` = refused/timeout, `skipped` = not probed.
     */
    challenge: 'reachable' | 'unreachable' | 'skipped'
}

/** The pre-flight verdicts, ordered worst-first. */
export type CertPreflightVerdict =
    | 'no_dns' // domain doesn't resolve at all — HTTP-01 AND DNS-01 both need the zone
    | 'wrong_ingress' // resolves, but not to this deployment — another box would get the challenge
    | 'unreachable' // points here, but port 80 isn't answering — challenge would time out
    | 'wildcard_needs_dns' // wildcards can never pass HTTP-01; use challenge: dns
    | 'ok'

/** A verdict plus the human sentence the UI shows verbatim. */
export interface CertPreflightResult {
    verdict: CertPreflightVerdict
    detail: string
}

/** The wildcard short-circuit — decided from the domain alone, before any probing. */
export function wildcardPreflight(): CertPreflightResult {
    return {
        verdict: 'wildcard_needs_dns',
        detail: 'A wildcard can never pass HTTP-01 — issue it with the DNS-01 challenge (stored DNS credentials).',
    }
}

/**
 * Classify the gathered signals. Order matters: no DNS beats everything (nothing
 * else is testable), a wrong ingress beats reachability (the probe hit someone
 * else's server), and the ingress comparison is skipped when Perch doesn't know its
 * own ingress IPs (unset setting — the check would only produce false alarms).
 */
export function classifyCertPreflight(s: CertPreflightSignals): CertPreflightResult {
    if (s.resolved.length === 0) {
        return {
            verdict: 'no_dns',
            detail: 'The domain does not resolve — create its DNS record first; issuance would be rejected by the CA.',
        }
    }
    if (s.ingress.length > 0 && !s.resolved.some((ip) => s.ingress.includes(ip))) {
        return {
            verdict: 'wrong_ingress',
            detail: `The domain resolves to ${s.resolved.join(', ')} — not this deployment's ingress (${s.ingress.join(
                ', ',
            )}). The CA's challenge would reach another server.`,
        }
    }
    if (s.challenge === 'unreachable') {
        return {
            verdict: 'unreachable',
            detail: 'The domain points here but nothing answered on port 80 — the HTTP-01 challenge would time out.',
        }
    }
    return {
        verdict: 'ok',
        detail:
            s.challenge === 'skipped'
                ? 'DNS looks right (challenge path not probed).'
                : 'DNS points here and the challenge path answers — issuance should pass.',
    }
}
