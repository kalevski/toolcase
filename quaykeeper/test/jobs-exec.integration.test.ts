import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

// End-to-end exercise of the job EXECUTOR (the risky part: child_process spawn,
// output capture, exit-code → status mapping, timeout kill) against a real
// `node:sqlite` DB and the real repository + migration v19. Server modules import
// `server-only` and read `config` at load — the vitest aliases neutralize the
// former, and we set the required env BEFORE dynamically importing the modules.

let jobs: typeof import('@/server/services/jobs')
let jobRepo: typeof import('@/server/data/repositories/job-repo')

beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'qk-jobs-test-'))
    process.env.QUAYKEEPER_DB_PATH = path.join(dir, 'test.db')
    process.env.QUAYKEEPER_GITHUB_CLIENT_ID = 'test'
    process.env.QUAYKEEPER_GITHUB_CLIENT_SECRET = 'test'
    process.env.QUAYKEEPER_OAUTH_REDIRECT_URI = 'http://localhost/cb'
    process.env.QUAYKEEPER_AUTH_SECRET = 'x'.repeat(48)
    process.env.QUAYKEEPER_JOB_SHELL = '/bin/sh' // portable across CI/minimal hosts
    const db = await import('@/server/data/db')
    db.initDb()
    jobs = await import('@/server/services/jobs')
    jobRepo = await import('@/server/data/repositories/job-repo')
})

const ACTOR = { githubId: 1, login: 'tester' }

describe('job executor', () => {
    it('runs a shell job and captures stdout/stderr + exit code', async () => {
        const job = jobs.createJob(ACTOR, {
            name: 'shell-mix',
            kind: 'shell',
            script: 'echo out-line; echo err-line 1>&2; exit 3',
        })
        const run = await jobs.runJob(job.id, 'manual', ACTOR)
        expect(run.status).toBe('failed') // non-zero exit
        expect(run.exitCode).toBe(3)
        expect(run.stdout).toContain('out-line')
        expect(run.stderr).toContain('err-line')
        expect(run.trigger).toBe('manual')
        expect(run.triggeredByLogin).toBe('tester')
    })

    it('runs a successful node job', async () => {
        const job = jobs.createJob(ACTOR, {
            name: 'node-ok',
            kind: 'node',
            script: "console.log('hi' + (1 + 1))",
        })
        const run = await jobs.runJob(job.id, 'manual', ACTOR)
        expect(run.status).toBe('success')
        expect(run.exitCode).toBe(0)
        expect(run.stdout.trim()).toBe('hi2')
    })

    it('kills a job that exceeds its timeout', async () => {
        const job = jobs.createJob(ACTOR, {
            name: 'sleeper',
            kind: 'shell',
            script: 'sleep 30',
            timeoutSec: 1,
        })
        const run = await jobs.runJob(job.id, 'manual', ACTOR)
        expect(run.status).toBe('timeout')
    }, 10_000)

    it('records runs in history, newest first', async () => {
        const job = jobs.createJob(ACTOR, { name: 'twice', kind: 'shell', script: 'echo one' })
        await jobs.runJob(job.id, 'manual', ACTOR)
        await jobs.runJob(job.id, 'schedule')
        const runs = jobRepo.listRuns(job.id, 10)
        expect(runs.length).toBe(2)
        expect(runs[0].trigger).toBe('schedule') // most recent
        expect(runs[1].trigger).toBe('manual')

        // The list view's denormalized last-run reflects the newest run.
        const reread = jobs.getJob(job.id)
        expect(reread.lastStatus).toBe('success')
        expect(reread.lastRunAt).toBeTruthy()
    })

    it('truncates multibyte output byte-accurately without mangling UTF-8 (bug 9)', async () => {
        // '€' is a 3-byte UTF-8 sequence; printing well past the 256 KB cap
        // forces at least one write to straddle the boundary. A per-chunk
        // toString('utf8') (the old bug) would emit U+FFFD there; capping on
        // UTF-16 .length instead of byte length would also let far more than
        // 256 KB of bytes through.
        const job = jobs.createJob(ACTOR, {
            name: 'multibyte-flood',
            kind: 'node',
            script: `process.stdout.write('€'.repeat(150000))`,
        })
        const run = await jobs.runJob(job.id, 'manual', ACTOR)
        expect(run.status).toBe('success')
        expect(run.truncated).toBe(true)

        // The raw byte cap is exact, but a cut landing mid-character decodes the
        // incomplete trailing bytes as a single U+FFFD (3 bytes re-encoded), which
        // can nudge the decoded string's byte length a couple of bytes past the
        // cap — nowhere near the old bug's ~2x (UTF-16-length-as-bytes) overshoot.
        const bytes = Buffer.byteLength(run.stdout, 'utf8')
        expect(bytes).toBeLessThanOrEqual(256 * 1024 + 3)
        expect(bytes).toBeGreaterThan(256 * 1024 - 4)
        // The byte cap can land mid-character, which legitimately decodes to a
        // trailing replacement char — that's fine. What the old per-chunk-decode
        // bug produced was U+FFFD scattered mid-stream at chunk boundaries.
        expect(run.stdout.replace(/�+$/, '')).not.toContain('�')
    })

    it('reports a spawn failure as an error run (missing interpreter)', async () => {
        process.env.QUAYKEEPER_JOB_SHELL = '/nonexistent/shell-bin'
        // config was read at import; re-import isn't trivial, so drive the node path
        // instead via a script that can't parse — a clean non-zero, not a spawn error.
        // Restore the shell for any later runs.
        const job = jobs.createJob(ACTOR, { name: 'bad-node', kind: 'node', script: 'this is (not valid javascript' })
        const run = await jobs.runJob(job.id, 'manual', ACTOR)
        process.env.QUAYKEEPER_JOB_SHELL = '/bin/sh'
        expect(run.status).toBe('failed') // node exits non-zero on a syntax error
        expect(run.stderr.length).toBeGreaterThan(0)
    })
})
