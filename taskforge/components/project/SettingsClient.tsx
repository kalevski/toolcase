'use client'

// E1 — per-project settings page. Tri-state selects ("use default" | value)
// persist only the overridden keys; clearing one falls back to the env config.

import React, { useCallback, useEffect, useState } from 'react'
import {
    Card,
    Heading,
    Text,
    Select,
    Input,
    Button,
    Checkbox,
    HelperText,
    NumberInput,
    toast,
} from '@toolcase/react-components'
import type { ProjectSettings } from '@/server/domain/types'
import { NOTIFY_EVENTS } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { helpTexts } from '../helpTexts'

type Tri = '' | 'on' | 'off'

const triOptions = [
    { value: '', label: 'Use default' },
    { value: 'on', label: 'On' },
    { value: 'off', label: 'Off' },
]

function toTri(v: boolean | undefined): Tri {
    return v === undefined ? '' : v ? 'on' : 'off'
}

function fromTri(v: Tri): boolean | undefined {
    return v === '' ? undefined : v === 'on'
}

export function SettingsClient() {
    const { project, modelOptions } = useProject()

    const [loaded, setLoaded] = useState(false)
    const [effective, setEffective] = useState<Record<string, unknown>>({})
    const [defaultModel, setDefaultModel] = useState('')
    const [commitAfter, setCommitAfter] = useState<Tri>('')
    const [commitMode, setCommitMode] = useState('')
    const [commitModel, setCommitModel] = useState('')
    const [warmSession, setWarmSession] = useState<Tri>('')
    const [knowledgeAuto, setKnowledgeAuto] = useState<Tri>('')
    const [usageGate, setUsageGate] = useState<number | ''>('')
    const [pushAfter, setPushAfter] = useState<Tri>('')
    const [branchPerRun, setBranchPerRun] = useState<Tri>('')
    const [review, setReview] = useState<Tri>('')
    const [openPr, setOpenPr] = useState<Tri>('')
    const [notifyEvents, setNotifyEvents] = useState<Set<string>>(() => new Set())
    const [notifyOverridden, setNotifyOverridden] = useState(false)
    const [webhookUrl, setWebhookUrl] = useState('')
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        try {
            const d = await fetch(`/api/projects/${project}/settings`).then((r) => (r.ok ? r.json() : null))
            if (!d) return
            const o: ProjectSettings = d.overrides
            setEffective(d.effective)
            setDefaultModel(o.defaultModel ?? '')
            setCommitAfter(toTri(o.commitAfter))
            setCommitMode(o.commitMessageMode ?? '')
            setCommitModel(o.commitModel ?? '')
            setWarmSession(toTri(o.warmSession))
            setKnowledgeAuto(toTri(o.knowledgeAutoUpdate))
            setUsageGate(o.usageGateThreshold ?? '')
            setPushAfter(toTri(o.pushAfter))
            setBranchPerRun(toTri(o.branchPerRun))
            setReview(toTri(o.review))
            setOpenPr(toTri(o.openPr))
            setNotifyOverridden(o.notifyEvents !== undefined)
            setNotifyEvents(new Set(o.notifyEvents ?? (d.effective.notifyEvents as string[]) ?? []))
            setWebhookUrl(o.notifyWebhookUrl ?? '')
            setLoaded(true)
        } catch {
            /* transient */
        }
    }, [project])

    useEffect(() => {
        void load()
    }, [load])

    const save = async () => {
        setSaving(true)
        try {
            const body: ProjectSettings = {
                defaultModel: defaultModel || undefined,
                commitAfter: fromTri(commitAfter),
                commitMessageMode: (commitMode || undefined) as ProjectSettings['commitMessageMode'],
                commitModel: commitModel || undefined,
                warmSession: fromTri(warmSession),
                knowledgeAutoUpdate: fromTri(knowledgeAuto),
                usageGateThreshold: usageGate === '' ? undefined : usageGate,
                pushAfter: fromTri(pushAfter),
                branchPerRun: fromTri(branchPerRun),
                review: fromTri(review),
                openPr: fromTri(openPr),
                notifyEvents: notifyOverridden ? [...notifyEvents] : undefined,
                notifyWebhookUrl: webhookUrl || undefined,
            }
            const res = await fetch(`/api/projects/${project}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) {
                toast.error((await res.json().catch(() => ({}))).error ?? 'Failed to save settings')
                return
            }
            const d = await res.json()
            setEffective(d.effective)
            toast.success('Settings saved — new runs and agents use them immediately')
        } finally {
            setSaving(false)
        }
    }

    if (!loaded) return null

    const eff = (k: string) => String(effective[k] ?? '—')

    return (
        <div className="tf-stack">
            <HelperText text={helpTexts.settings.intro} />

            <Card header={<Heading as="h3">Run defaults</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    <div className="tf-form-row">
                        <div style={{ minWidth: 220 }}>
                            <Select
                                label={`Default model (env: ${eff('defaultModel')})`}
                                options={[{ value: '', label: 'Use default' }, ...modelOptions]}
                                value={defaultModel}
                                onChange={(e) => setDefaultModel(e.target.value)}
                            />
                        </div>
                        <Select label="Warm session" options={triOptions} value={warmSession} onChange={(e) => setWarmSession(e.target.value as Tri)} />
                        <Select label="Commit after task" options={triOptions} value={commitAfter} onChange={(e) => setCommitAfter(e.target.value as Tri)} />
                        <Select
                            label="Commit message"
                            options={[
                                { value: '', label: 'Use default' },
                                { value: 'taskname', label: 'Task name' },
                                { value: 'ai', label: 'AI-generated' },
                            ]}
                            value={commitMode}
                            onChange={(e) => setCommitMode(e.target.value)}
                        />
                        <div style={{ minWidth: 200 }}>
                            <Select
                                label="Commit model"
                                options={[{ value: '', label: 'Use default' }, ...modelOptions]}
                                value={commitModel}
                                onChange={(e) => setCommitModel(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="tf-form-row">
                        <Select label="Branch per run" options={triOptions} value={branchPerRun} onChange={(e) => setBranchPerRun(e.target.value as Tri)} />
                        <Select label="Push after run" options={triOptions} value={pushAfter} onChange={(e) => setPushAfter(e.target.value as Tri)} />
                        <Select label="Open PR after push" options={triOptions} value={openPr} onChange={(e) => setOpenPr(e.target.value as Tri)} />
                        <Select label="Reviewer pass" options={triOptions} value={review} onChange={(e) => setReview(e.target.value as Tri)} />
                    </div>
                </div>
            </Card>

            <Card header={<Heading as="h3">Knowledge & usage</Heading>}>
                <div className="tf-card-body tf-form-row">
                    <Select
                        label="Knowledge auto-update"
                        options={triOptions}
                        value={knowledgeAuto}
                        onChange={(e) => setKnowledgeAuto(e.target.value as Tri)}
                    />
                    <div style={{ maxWidth: 240 }}>
                        <NumberInput
                            label={`Usage-gate threshold % (env: ${eff('usageGateThreshold')})`}
                            min={1}
                            max={100}
                            value={usageGate}
                            onChange={(v) => setUsageGate(v)}
                        />
                    </div>
                </div>
            </Card>

            <Card header={<Heading as="h3">Notifications</Heading>}>
                <div className="tf-card-body tf-stack-sm">
                    <HelperText text={helpTexts.settings.notify} />
                    <Checkbox
                        label="Override the global event selection for this project"
                        checked={notifyOverridden}
                        onChange={(e) => setNotifyOverridden(e.target.checked)}
                    />
                    {notifyOverridden && (
                        <div className="tf-form-row">
                            {NOTIFY_EVENTS.map((ev) => (
                                <Checkbox
                                    key={ev}
                                    label={ev}
                                    inline
                                    checked={notifyEvents.has(ev)}
                                    onChange={(e) =>
                                        setNotifyEvents((prev) => {
                                            const next = new Set(prev)
                                            if (e.target.checked) next.add(ev)
                                            else next.delete(ev)
                                            return next
                                        })
                                    }
                                />
                            ))}
                        </div>
                    )}
                    <Input
                        label="Outbound JSON webhook URL (blank = env default)"
                        placeholder="https://ntfy.sh/my-topic"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                </div>
            </Card>

            <div className="tf-actions">
                <Button variant="primary" loading={saving} disabled={saving} onClick={() => void save()}>
                    Save settings
                </Button>
                <Text variant="muted">Empty / “Use default” values fall back to the environment configuration.</Text>
            </div>
        </div>
    )
}
