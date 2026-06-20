'use client'

// B3 — per-project schedule card on the Run page.

import React, { useEffect, useState } from 'react'
import {
    Card,
    Heading,
    Text,
    Input,
    Select,
    Switch,
    Button,
    Badge,
    HelperText,
    NumberInput,
    toast,
} from '@/components/ui'
import type { ScheduleRecord } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
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
    const [loaded, setLoaded] = useState(false)
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
                    skipAboveUsage: usageGate === '' ? null : usageGate,
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
        const res = await fetch(`/api/projects/${project}/schedule`, { method: 'DELETE' })
        if (!res.ok) {
            toast.error('Failed to remove schedule')
            return
        }
        setExists(false)
        setEnabled(true)
        toast.success('Schedule removed')
    }

    if (!loaded) return null

    return (
        <Card
            header={
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                    <Heading as="h3">Scheduled runs</Heading>
                    {exists && <Badge variant={enabled ? 'success' : 'secondary'}>{enabled ? 'enabled' : 'disabled'}</Badge>}
                </div>
            }
        >
            <div className="tf-card-body tf-stack-sm">
                <HelperText text={helpTexts.run.schedule} />
                <div className="tf-form-row">
                    <Select
                        label="Preset"
                        options={PRESETS}
                        value={PRESETS.some((p) => p.value === cron) ? cron : ''}
                        onChange={(e) => e.target.value && setCron(e.target.value)}
                    />
                    <Input
                        label="Cron (min hour dom mon dow)"
                        value={cron}
                        onChange={(e) => setCron(e.target.value)}
                        placeholder="0 2 * * *"
                    />
                    <Select
                        label="Model"
                        options={[{ value: '', label: `Project default (${config.defaultModel})` }, ...modelOptions]}
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                    />
                </div>
                <div className="tf-form-row">
                    <Switch label="Enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                    <Switch label="Only if pending > 0" checked={onlyIfPending} onChange={(e) => setOnlyIfPending(e.target.checked)} />
                    <Switch label="Commit after each task" checked={commitAfter} onChange={(e) => setCommitAfter(e.target.checked)} />
                    {config.canPush && (
                        <Switch label="Push after run" checked={pushAfter} onChange={(e) => setPushAfter(e.target.checked)} />
                    )}
                    <div style={{ maxWidth: 200 }}>
                        <NumberInput
                            label="Skip if usage ≥ % (blank = off)"
                            min={1}
                            max={100}
                            value={usageGate}
                            onChange={(v) => setUsageGate(v)}
                        />
                    </div>
                </div>
                {lastFired && <Text variant="muted">Last fired: {new Date(lastFired).toLocaleString()}</Text>}
                <div className="tf-actions">
                    <Button variant="primary" loading={saving} disabled={saving} onClick={() => void save()}>
                        {exists ? 'Update schedule' : 'Create schedule'}
                    </Button>
                    {exists && (
                        <Button variant="danger" outline onClick={() => void remove()}>
                            Remove
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    )
}
