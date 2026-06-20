'use client'

// B3 — per-project schedule card on the Run page.

import React, { useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { useTcEvents, detailValue } from '@/lib/tc'
import type { ScheduleRecord } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { useConfirm } from '../ConfirmModal'
import { helpTexts } from '../helpTexts'

const PRESETS = [
    { value: '', label: 'Custom…' },
    { value: '0 2 * * *', label: 'Every day at 02:00' },
    { value: '0 2 * * 1-5', label: 'Weekdays at 02:00' },
    { value: '0 */6 * * *', label: 'Every 6 hours' },
    { value: '0 22 * * 5', label: 'Fridays at 22:00' },
]

export function ScheduleCard() {
    const { project, modelOptions, config } = useProject()
    const confirm = useConfirm()
    const [loaded, setLoaded] = useState(false)
    const [removing, setRemoving] = useState(false)
    const [exists, setExists] = useState(false)
    const [enabled, setEnabled] = useState(true)
    const [cron, setCron] = useState('0 2 * * *')
    const [model, setModel] = useState('')
    const [onlyIfPending, setOnlyIfPending] = useState(true)
    const [usageGate, setUsageGate] = useState<number | ''>('')
    const [commitAfter, setCommitAfter] = useState(true)
    const [pushAfter, setPushAfter] = useState(false)
    const [lastFired, setLastFired] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const presetRef = useTcEvents<HTMLElement>({
        change: (e) => {
            const v = (e.target as HTMLSelectElement).value
            if (v) setCron(v)
        },
    })
    const cronRef = useTcEvents<HTMLElement>({ input: (e) => setCron((e.target as HTMLInputElement).value) })
    const modelRef = useTcEvents<HTMLElement>({ change: (e) => setModel((e.target as HTMLSelectElement).value) })
    const enabledRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setEnabled(detailValue<boolean>(e)) })
    const onlyIfPendingRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setOnlyIfPending(detailValue<boolean>(e)) })
    const commitAfterRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setCommitAfter(detailValue<boolean>(e)) })
    const pushAfterRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setPushAfter(detailValue<boolean>(e)) })
    const usageGateRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setUsageGate(detailValue<number | ''>(e)) })

    useEffect(() => {
        let cancelled = false
        fetch(`/api/projects/${project}/schedule`)
            .then((r) => (r.ok ? r.json() : null))
            .then((s: ScheduleRecord | null) => {
                if (cancelled) return
                setLoaded(true)
                if (!s) return
                setExists(true)
                setEnabled(s.enabled)
                setCron(s.cron)
                setModel(s.options.model ?? '')
                setOnlyIfPending(s.onlyIfPending)
                setUsageGate(s.skipAboveUsage ?? '')
                setCommitAfter(s.options.commitAfter ?? true)
                setPushAfter(s.options.pushAfter ?? false)
                setLastFired(s.lastFiredAt)
            })
            .catch(() => setLoaded(true))
        return () => {
            cancelled = true
        }
    }, [project])

    const save = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/projects/${project}/schedule`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cron,
                    enabled,
                    onlyIfPending,
                    skipAboveUsage: usageGate === '' ? null : Math.min(100, Math.max(1, usageGate)),
                    options: {
                        model: model || undefined,
                        commitAfter,
                        pushAfter: pushAfter || undefined,
                    },
                }),
            })
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to save schedule')
                return
            }
            setExists(true)
            toast.success('Schedule saved')
        } finally {
            setSaving(false)
        }
    }

    const remove = async () => {
        const ok = await confirm({
            title: 'Remove schedule?',
            body: 'Scheduled runs for this project will stop. You can recreate the schedule later.',
            confirmLabel: 'Remove',
            confirmVariant: 'danger',
        })
        if (!ok) return
        setRemoving(true)
        try {
            const res = await fetch(`/api/projects/${project}/schedule`, { method: 'DELETE' })
            if (!res.ok) {
                toast.error('Failed to remove schedule')
                return
            }
            setExists(false)
            setEnabled(true)
            toast.success('Schedule removed')
        } finally {
            setRemoving(false)
        }
    }

    if (!loaded) return null

    return (
        <tc-card>
            <div slot="header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                <tc-heading as="h3">Scheduled runs</tc-heading>
                {exists && (
                    <tc-badge variant={enabled ? 'success' : 'secondary'}>{enabled ? 'enabled' : 'disabled'}</tc-badge>
                )}
            </div>
            <div className="tf-card-body tf-stack-sm">
                <tc-helper-text text={helpTexts.run.schedule} />
                <div className="tf-form-row">
                    <tc-select ref={presetRef} label="Preset" value={PRESETS.some((p) => p.value === cron) ? cron : ''}>
                        {PRESETS.map((p) => (
                            <tc-option key={p.value} value={p.value}>
                                {p.label}
                            </tc-option>
                        ))}
                    </tc-select>
                    <tc-input
                        ref={cronRef}
                        label="Cron (min hour dom mon dow)"
                        value={cron}
                        placeholder="0 2 * * *"
                    />
                    <tc-select ref={modelRef} label="Model" value={model}>
                        <tc-option value="">Project default ({config.defaultModel})</tc-option>
                        {modelOptions.map((m) => (
                            <tc-option key={m.value} value={m.value}>
                                {m.label}
                            </tc-option>
                        ))}
                    </tc-select>
                </div>
                <div className="tf-form-row">
                    <tc-switch ref={enabledRef} label="Enabled" checked={enabled || undefined} />
                    <tc-switch ref={onlyIfPendingRef} label="Only if pending > 0" checked={onlyIfPending || undefined} />
                    <tc-switch ref={commitAfterRef} label="Commit after each task" checked={commitAfter || undefined} />
                    {config.canPush && (
                        <tc-switch ref={pushAfterRef} label="Push after run" checked={pushAfter || undefined} />
                    )}
                    <div style={{ maxWidth: 200 }}>
                        <tc-number-input
                            ref={usageGateRef}
                            label="Skip if usage ≥ % (blank = off)"
                            min={1}
                            max={100}
                            value={usageGate}
                        />
                    </div>
                </div>
                {lastFired && <tc-text variant="muted">Last fired: {new Date(lastFired).toLocaleString()}</tc-text>}
                <div className="tf-actions">
                    <tc-button variant="primary" loading={saving || undefined} disabled={saving || undefined} onClick={() => void save()}>
                        {exists ? 'Update schedule' : 'Create schedule'}
                    </tc-button>
                    {exists && (
                        <tc-button variant="danger" outline loading={removing || undefined} disabled={removing || undefined} onClick={() => void remove()}>
                            Remove
                        </tc-button>
                    )}
                </div>
            </div>
        </tc-card>
    )
}
