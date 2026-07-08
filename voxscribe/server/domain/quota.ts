// Pure quota decision (spec §6.3): (usedBytes, incomingBytes, quotaBytes, role)
// → allow/deny. Admins are exempt (§4.1).

import type { Role } from './types'

export interface QuotaDecision {
    allowed: boolean
    usedBytes: number
    /** Bytes still available (Infinity for exempt roles). */
    remainingBytes: number
}

export function checkQuota(
    usedBytes: number,
    incomingBytes: number,
    quotaBytes: number,
    role: Role,
): QuotaDecision {
    if (role === 'admin') {
        return { allowed: true, usedBytes, remainingBytes: Number.POSITIVE_INFINITY }
    }
    const remainingBytes = Math.max(0, quotaBytes - usedBytes)
    return { allowed: usedBytes + incomingBytes <= quotaBytes, usedBytes, remainingBytes }
}
