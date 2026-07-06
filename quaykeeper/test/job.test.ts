import { describe, it, expect } from 'vitest'
import {
    JOB_SCRIPT_MAX,
    JOB_TIMEOUT_DEFAULT,
    JOB_TIMEOUT_MAX,
    validateJobInput,
} from '@/server/domain/job'

/** Convenience: assert failure and return the error field for a terse assertion. */
function fieldOf(raw: Parameters<typeof validateJobInput>[0]): string {
    const r = validateJobInput(raw)
    if (r.ok) throw new Error('expected validation to fail')
    return r.error.field
}

describe('validateJobInput', () => {
    const base = { name: 'nightly', kind: 'shell', script: 'echo hi' }

    it('accepts a minimal shell job (manual-only)', () => {
        const r = validateJobInput(base)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.input.name).toBe('nightly')
            expect(r.input.kind).toBe('shell')
            expect(r.input.schedule).toBeNull() // no schedule = manual-only
            expect(r.input.enabled).toBe(true) // default
            expect(r.input.timeoutSec).toBe(JOB_TIMEOUT_DEFAULT)
        }
    })

    it('trims the name and rejects empty / oversized names', () => {
        const r = validateJobInput({ ...base, name: '  spaced  ' })
        expect(r.ok && r.input.name).toBe('spaced')
        expect(fieldOf({ ...base, name: '   ' })).toBe('name')
        expect(fieldOf({ ...base, name: 'x'.repeat(65) })).toBe('name')
    })

    it('rejects an unknown kind', () => {
        expect(fieldOf({ ...base, kind: 'python' })).toBe('kind')
    })

    it('requires a non-empty script within the size cap', () => {
        expect(fieldOf({ ...base, script: '   ' })).toBe('script')
        expect(fieldOf({ ...base, script: 'x'.repeat(JOB_SCRIPT_MAX + 1) })).toBe('script')
    })

    it('accepts a valid cron and rejects a malformed one', () => {
        const ok = validateJobInput({ ...base, schedule: '*/15 * * * *' })
        expect(ok.ok && ok.input.schedule).toBe('*/15 * * * *')
        expect(fieldOf({ ...base, schedule: 'not a cron' })).toBe('schedule')
        expect(fieldOf({ ...base, schedule: '99 * * * *' })).toBe('schedule')
    })

    it('treats a blank schedule as manual-only', () => {
        const r = validateJobInput({ ...base, schedule: '   ' })
        expect(r.ok && r.input.schedule).toBeNull()
    })

    it('enforces the timeout bounds as integers', () => {
        expect(fieldOf({ ...base, timeoutSec: 0 })).toBe('timeoutSec')
        expect(fieldOf({ ...base, timeoutSec: JOB_TIMEOUT_MAX + 1 })).toBe('timeoutSec')
        expect(fieldOf({ ...base, timeoutSec: 1.5 })).toBe('timeoutSec')
        const ok = validateJobInput({ ...base, timeoutSec: 120 })
        expect(ok.ok && ok.input.timeoutSec).toBe(120)
    })

    it('merges partial updates over supplied defaults', () => {
        const defaults = {
            name: 'nightly',
            kind: 'node' as const,
            script: 'console.log(1)',
            schedule: '0 3 * * *',
            enabled: true,
            timeoutSec: 300,
        }
        // Only the schedule changes; everything else inherits the stored job.
        const r = validateJobInput({ schedule: '0 4 * * *' }, defaults)
        expect(r.ok).toBe(true)
        if (r.ok) {
            expect(r.input.kind).toBe('node')
            expect(r.input.script).toBe('console.log(1)')
            expect(r.input.schedule).toBe('0 4 * * *')
            expect(r.input.timeoutSec).toBe(300)
        }
    })
})
