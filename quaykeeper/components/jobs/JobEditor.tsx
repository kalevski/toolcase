'use client'

import { useCallback, useMemo, useState } from 'react'
import {
    JOB_TIMEOUT_DEFAULT,
    validateJobInput,
    type JobKind,
    type ScheduledJob,
} from '@/server/domain/job'
import { InvalidCronError, nextRun, parseCron } from '@/server/domain/cron'
import { callApi } from '@/components/config/shared'
import { FormModal, FormGroup } from '@/components/FormModal'
import { SelectField, SwitchField, TextAreaField, TextField, type SelectOption } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Create/edit form for a scheduled job. `domain/cron.ts` + `domain/job.ts` are pure
// (no server-only), so this reuses the SAME cron parser (live next-run preview +
// inline schedule error) and validator the server enforces — the form can't submit a
// shape the API would reject.

const KIND_OPTIONS: SelectOption[] = [
    { value: 'shell', label: 'Shell (bash)' },
    { value: 'node', label: 'JavaScript (node)' },
]

interface Draft {
    name: string
    description: string
    kind: JobKind
    schedule: string
    enabled: boolean
    timeoutSec: string
    script: string
}

function draftFor(job: ScheduledJob | null): Draft {
    return {
        name: job?.name ?? '',
        description: job?.description ?? '',
        kind: job?.kind ?? 'shell',
        schedule: job?.schedule ?? '',
        enabled: job?.enabled ?? true,
        timeoutSec: String(job?.timeoutSec ?? JOB_TIMEOUT_DEFAULT),
        script: job?.script ?? '',
    }
}

const SCRIPT_PLACEHOLDER: Record<JobKind, string> = {
    shell: '#!/usr/bin/env bash\nset -euo pipefail\n\necho "hello from the server"\ndf -h /',
    node: "console.log('hello from node', process.version)",
}

/** Resolve the schedule field into either a human next-run line or a parse error. */
function scheduleFeedback(schedule: string): { error?: string; hint?: string } {
    const trimmed = schedule.trim()
    if (trimmed === '') return { hint: 'Leave empty for a manual-only job (run on demand from the list).' }
    try {
        const spec = parseCron(trimmed)
        const next = nextRun(spec, new Date())
        return {
            hint: next
                ? `Next run: ${next.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                : 'Valid, but never fires in the next year.',
        }
    } catch (err) {
        return { error: err instanceof InvalidCronError ? err.message : 'Invalid cron expression.' }
    }
}

export function JobEditor({
    job,
    onClose,
    onSaved,
}: {
    /** The job being edited, or null to create a new one. */
    job: ScheduledJob | null
    onClose: () => void
    onSaved: () => void
}) {
    const toast = useToast()
    const [draft, setDraft] = useState<Draft>(() => draftFor(job))
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const patch = (p: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...p }))

    const sched = useMemo(() => scheduleFeedback(draft.schedule), [draft.schedule])

    const save = useCallback(async () => {
        if (busy) return
        const payload = {
            name: draft.name,
            description: draft.description,
            kind: draft.kind,
            script: draft.script,
            schedule: draft.schedule,
            enabled: draft.enabled,
            timeoutSec: Number(draft.timeoutSec),
        }
        const result = validateJobInput(payload)
        if (!result.ok) {
            setError(result.error.message)
            return
        }
        setBusy(true)
        setError(null)
        const res = job
            ? await callApi(`/api/jobs/${encodeURIComponent(job.id)}`, 'PATCH', payload)
            : await callApi('/api/jobs', 'POST', payload)
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t save “${result.input.name}”: ${res.message}`)
            return
        }
        toast.show(`Saved “${result.input.name}”.`, { variant: 'success' })
        onSaved()
    }, [busy, draft, job, onSaved, toast])

    return (
        <FormModal
            title={job ? 'Edit task' : 'New task'}
            busy={busy}
            submitLabel={job ? 'Save changes' : 'Create task'}
            onSubmit={() => void save()}
            onClose={onClose}
        >
            {error && <tc-banner variant="error">{error}</tc-banner>}

            <FormGroup title="Identity">
                <div className="quaykeeper-form-grid">
                    <TextField label="Name" placeholder="nightly-backup" value={draft.name} onValue={(v) => patch({ name: v })} />
                    <TextField
                        label="Description"
                        placeholder="Optional"
                        value={draft.description}
                        onValue={(v) => patch({ description: v })}
                    />
                </div>
            </FormGroup>

            <FormGroup title="Schedule">
                <div className="quaykeeper-form-grid">
                    <SelectField
                        label="Interpreter"
                        value={draft.kind}
                        options={KIND_OPTIONS}
                        onValue={(v) => patch({ kind: v as JobKind })}
                    />
                    <TextField
                        label="Cron schedule"
                        placeholder="0 3 * * *"
                        value={draft.schedule}
                        onValue={(v) => patch({ schedule: v })}
                        state={sched.error ? 'invalid' : undefined}
                        error={sched.error}
                        help={sched.hint}
                    />
                    <TextField
                        label="Timeout (seconds)"
                        type="number"
                        min={1}
                        max={3600}
                        value={draft.timeoutSec}
                        onValue={(v) => patch({ timeoutSec: v })}
                        help="Killed if it runs longer."
                    />
                </div>
                <p className="quaykeeper-admin-hint">
                    Five fields: <code>minute hour day-of-month month day-of-week</code>. Example: <code>*/15 * * * *</code>{' '}
                    every 15 minutes, <code>0 3 * * *</code> daily at 03:00.
                </p>
                <SwitchField
                    checked={draft.enabled}
                    onChecked={(v) => patch({ enabled: v })}
                    label="Enabled"
                    help="A disabled task never fires on its schedule (you can still run it now)."
                />
            </FormGroup>

            <FormGroup title="Script">
                <TextAreaField
                    ariaLabel="Script source"
                    rows={14}
                    className="quaykeeper-admin-mono"
                    placeholder={SCRIPT_PLACEHOLDER[draft.kind]}
                    value={draft.script}
                    onValue={(v) => patch({ script: v })}
                />
                <p className="quaykeeper-admin-hint">
                    Runs on the Quaykeeper host as the app’s user.{' '}
                    {draft.kind === 'shell'
                        ? 'Executed with bash. Non-zero exit = failed run.'
                        : 'Executed with the app’s node binary as an ES module. Non-zero exit = failed run.'}
                </p>
            </FormGroup>
        </FormModal>
    )
}
