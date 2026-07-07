'use client'

import { FormGroup } from '@/components/FormModal'
import { SelectField, TextAreaField, TextField } from '@/components/fields'
import type { LogShaping } from '@/server/domain/nginxpilot-logdest-fragment'

// Shared shaping sub-form for log bindings (logs_feature.md §11/§12) — the
// per-source half of a destination assignment: Loki labels (loki destinations
// only), field filters, parse templates (instance scope only) and the shipping
// tunables. Used by the Servers-page RealmLogDestModal and the instance Logs
// tab; the endpoint half (URL/TLS/auth) lives on /admin/log-destinations.

/** Everything the shaping sub-form holds, as form-friendly strings. */
export interface ShapingDraft {
    job: string
    hostLabel: string
    statusLabel: string
    extraLabels: string
    filterText: string
    parseText: string
    sample: string
    batchSize: string
    flushInterval: string
    maxRetries: string
    bufferSize: string
}

export const emptyShapingDraft = (scope: 'realm' | 'instance'): ShapingDraft => ({
    job: 'nginx',
    hostLabel: scope === 'realm' ? '$resource' : 'none',
    statusLabel: scope === 'realm' ? '$status' : 'none',
    extraLabels: '',
    filterText: '',
    parseText: '',
    sample: '',
    batchSize: '',
    flushInterval: '',
    maxRetries: '',
    bufferSize: '',
})

/** Reconstruct an editing draft from a stored binding's shaping. */
export function shapingDraftOf(s: LogShaping): ShapingDraft {
    const labels = s.labels ?? {}
    const extraLabels = Object.entries(labels)
        .filter(([k]) => k !== 'job' && k !== 'host' && k !== 'status_code')
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
    const filterText = Object.entries(s.filter ?? {})
        .map(([field, list]) => `${field}: ${list.join(', ')}`)
        .join('\n')
    return {
        job: labels.job ?? 'nginx',
        hostLabel: labels.host ?? 'none',
        statusLabel: labels.status_code ?? 'none',
        extraLabels,
        filterText,
        parseText: (s.parse ?? []).join('\n'),
        sample: s.sample !== undefined ? String(s.sample) : '',
        batchSize: s.batch_size !== undefined ? String(s.batch_size) : '',
        flushInterval: s.flush_interval ?? '',
        maxRetries: s.max_retries !== undefined ? String(s.max_retries) : '',
        bufferSize: s.buffer_size !== undefined ? String(s.buffer_size) : '',
    }
}

const numOr = (raw: string): number | undefined => {
    const t = raw.trim()
    if (t === '') return undefined
    const n = Number(t)
    return Number.isFinite(n) ? n : undefined
}

/** Assemble the API `shaping` payload from the draft, including only fields relevant to scope/type. */
export function buildShapingPayload(
    d: ShapingDraft,
    opts: { scope: 'realm' | 'instance'; loki: boolean },
): Record<string, unknown> {
    const shaping: Record<string, unknown> = {}

    if (opts.loki) {
        const labels: Record<string, string> = {}
        if (d.job.trim()) labels.job = d.job.trim()
        if (d.hostLabel !== 'none') labels.host = d.hostLabel
        if (d.statusLabel !== 'none') labels.status_code = d.statusLabel
        for (const line of d.extraLabels.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed) continue
            const m = trimmed.match(/^([^=:]+)[=:]\s*(.+)$/)
            if (m) labels[m[1].trim()] = m[2].trim()
        }
        if (Object.keys(labels).length) shaping.labels = labels
    }

    const filter: Record<string, string[]> = {}
    for (const line of d.filterText.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const idx = trimmed.indexOf(':')
        if (idx < 0) continue
        const field = trimmed.slice(0, idx).trim()
        const matchers = trimmed
            .slice(idx + 1)
            .split(',')
            .map((m) => m.trim())
            .filter(Boolean)
        if (field && matchers.length) filter[field] = matchers
    }
    if (Object.keys(filter).length) shaping.filter = filter

    if (opts.scope === 'instance') {
        const templates = d.parseText
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
        if (templates.length) shaping.parse = templates
    }

    if (numOr(d.sample) !== undefined) shaping.sample = numOr(d.sample)
    if (numOr(d.batchSize) !== undefined) shaping.batch_size = numOr(d.batchSize)
    if (numOr(d.maxRetries) !== undefined) shaping.max_retries = numOr(d.maxRetries)
    if (numOr(d.bufferSize) !== undefined) shaping.buffer_size = numOr(d.bufferSize)
    if (d.flushInterval.trim()) shaping.flush_interval = d.flushInterval.trim()

    return shaping
}

/** Live LogQL preview from the current draft's label config (loki only). */
export function draftLogql(d: ShapingDraft): string {
    const parts = [`job="${d.job.trim() || 'nginx'}"`]
    if (d.hostLabel !== 'none') parts.push('host=~".+"')
    if (d.statusLabel !== 'none') parts.push('status_code=~".+"')
    for (const line of d.extraLabels.split('\n')) {
        const m = line.trim().match(/^([^=:]+)[=:]\s*(.+)$/)
        if (m) parts.push(`${m[1].trim()}="${m[2].trim()}"`)
    }
    return `{${parts.join(', ')}}`
}

/** The shaping FormGroups — dropped into a FormModal after the destination select. */
export function ShapingFields({
    draft,
    onPatch,
    scope,
    loki,
}: {
    draft: ShapingDraft
    onPatch: (p: Partial<ShapingDraft>) => void
    scope: 'realm' | 'instance'
    loki: boolean
}) {
    return (
        <>
            {loki && (
                <FormGroup title="Loki labels">
                    <TextField
                        label="job"
                        placeholder="nginx"
                        help="Static label (default nginx)."
                        value={draft.job}
                        onValue={(v) => onPatch({ job: v })}
                    />
                    <SelectField
                        label="host label"
                        help="$resource is bounded + recommended; $host is unsafe under wildcard vhosts."
                        value={draft.hostLabel}
                        options={[
                            { value: 'none', label: 'No host label' },
                            { value: '$resource', label: '$resource (entity name — recommended)' },
                            { value: '$host', label: '$host (client Host header)' },
                            { value: '$server_name', label: '$server_name' },
                        ]}
                        onValue={(v) => onPatch({ hostLabel: v })}
                    />
                    <SelectField
                        label="status_code label"
                        value={draft.statusLabel}
                        options={[
                            { value: 'none', label: 'No status label' },
                            { value: '$status', label: '$status (exact code)' },
                            { value: '$status_class', label: '$status_class (4xx / 5xx)' },
                        ]}
                        onValue={(v) => onPatch({ statusLabel: v })}
                    />
                    <TextAreaField
                        label="Extra static labels"
                        rows={2}
                        placeholder={'region=eu\nenv=prod'}
                        help="One key=value per line (static only, max 5)."
                        value={draft.extraLabels}
                        onValue={(v) => onPatch({ extraLabels: v })}
                    />
                    <p className="quaykeeper-admin-hint">
                        Selector: <span className="quaykeeper-admin-mono">{draftLogql(draft)}</span>
                    </p>
                </FormGroup>
            )}

            <FormGroup title="Filter">
                <TextAreaField
                    label="Field matchers"
                    rows={4}
                    placeholder={'status: 4xx, 5xx\npath: !/healthz, !/metrics\nmethod: GET, POST'}
                    help="One field per line: field: matcher, matcher. AND across lines, OR within a line. Fields: host, resource, path, user_agent, status, method, scheme, resource_type. Leading ! negates."
                    value={draft.filterText}
                    onValue={(v) => onPatch({ filterText: v })}
                />
            </FormGroup>

            {scope === 'instance' && (
                <FormGroup title="Parse templates">
                    <TextAreaField
                        label="Plain-text → structured"
                        rows={3}
                        placeholder={'{level} | {time} - {message}'}
                        help="One template per line. A non-JSON log line matching a template becomes structured JSON (e.g. info | 12:20 - hi → {level,time,message}), so level/status filters and Loki labels work. First match wins; non-matching lines ship raw."
                        value={draft.parseText}
                        onValue={(v) => onPatch({ parseText: v })}
                    />
                </FormGroup>
            )}

            <FormGroup title="Shipping (optional)">
                <TextField label="Sample (0–1]" placeholder="1.0" value={draft.sample} onValue={(v) => onPatch({ sample: v })} />
                <TextField label="Batch size" type="number" placeholder="500" value={draft.batchSize} onValue={(v) => onPatch({ batchSize: v })} />
                <TextField label="Flush interval" placeholder="2s" value={draft.flushInterval} onValue={(v) => onPatch({ flushInterval: v })} />
                <TextField label="Max retries" type="number" placeholder="3" value={draft.maxRetries} onValue={(v) => onPatch({ maxRetries: v })} />
                <TextField label="Buffer size (entries)" type="number" placeholder="8192" value={draft.bufferSize} onValue={(v) => onPatch({ bufferSize: v })} />
            </FormGroup>
        </>
    )
}
