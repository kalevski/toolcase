'use client'

// E1 — per-project settings page. Tri-state selects ("use default" | value)
// persist only the overridden keys; clearing one falls back to the env config.

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from '@/lib/toast'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTcEvents, detailValue } from '@/lib/tc'
import type { AccountSummary, ProjectSettings } from '@/server/domain/types'
import { NOTIFY_EVENTS } from '@/server/domain/types'
import { useProject } from '../ProjectContext'
import { ErrorState, LoadingState } from '../states'
import { helpTexts } from '../helpTexts'

type Tri = '' | 'on' | 'off'

function toTri(v: boolean | undefined): Tri {
    return v === undefined ? '' : v ? 'on' : 'off'
}

function fromTri(v: Tri): boolean | undefined {
    return v === '' ? undefined : v === 'on'
}

// ── file-local tc-* binders (event wiring + loop reuse; not a shared kit) ──────

function TriSel({ label, value, onChange }: { label: string; value: Tri; onChange: (v: Tri) => void }) {
    const ref = useTcEvents<HTMLElement>({ change: (e) => onChange((e.target as HTMLSelectElement).value as Tri) })
    return (
        <tc-select ref={ref} label={label} value={value}>
            <tc-option value="">Use default</tc-option>
            <tc-option value="on">On</tc-option>
            <tc-option value="off">Off</tc-option>
        </tc-select>
    )
}

function Sel({
    label,
    value,
    onChange,
    children,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    children: React.ReactNode
}) {
    const ref = useTcEvents<HTMLElement>({ change: (e) => onChange((e.target as HTMLSelectElement).value) })
    return (
        <tc-select ref={ref} label={label} value={value}>
            {children}
        </tc-select>
    )
}

function Chk({
    label,
    checked,
    onChange,
    inline,
}: {
    label: string
    checked: boolean
    onChange: (c: boolean) => void
    inline?: boolean
}) {
    const ref = useTcEvents<HTMLElement>({ change: (e) => onChange((e.target as HTMLInputElement).checked) })
    return <tc-check ref={ref} label={label} checked={checked || undefined} inline={inline || undefined} />
}

export function SettingsClient() {
    const { project, modelOptions } = useProject()

    const [loaded, setLoaded] = useState(false)
    const [effective, setEffective] = useState<Record<string, unknown>>({})
    const [accounts, setAccounts] = useState<AccountSummary[]>([])
    const [defaultModel, setDefaultModel] = useState('')
    const [defaultAccount, setDefaultAccount] = useState('')
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
    const [loadError, setLoadError] = useState(false)

    const usageRef = useTcEvents<HTMLElement>({ 'tc-change': (e) => setUsageGate(detailValue<number | ''>(e)) })
    const webhookRef = useTcEvents<HTMLElement>({ input: (e) => setWebhookUrl((e.target as HTMLInputElement).value) })

    const load = useCallback(async () => {
        setLoadError(false)
        try {
            // Account registry is owner-gated — fetch best-effort so non-owners
            // still load settings (they just get an empty account list).
            const [d, accs] = await Promise.all([
                apiFetch<{ overrides: ProjectSettings; effective: Record<string, unknown> }>(
                    `/api/projects/${project}/settings`,
                ),
                apiFetch<AccountSummary[]>('/api/accounts').catch(() => []),
            ])
            if (!d) {
                setLoadError(true)
                return
            }
            const o: ProjectSettings = d.overrides
            setEffective(d.effective)
            setAccounts(Array.isArray(accs) ? accs : [])
            setDefaultModel(o.defaultModel ?? '')
            setDefaultAccount(o.defaultAccount ?? '')
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
            const events = Array.isArray(o.notifyEvents)
                ? o.notifyEvents
                : Array.isArray(d.effective?.notifyEvents)
                  ? (d.effective.notifyEvents as string[])
                  : []
            setNotifyEvents(new Set(events))
            setWebhookUrl(o.notifyWebhookUrl ?? '')
            setLoaded(true)
        } catch {
            setLoadError(true)
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
                defaultAccount: defaultAccount || undefined,
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
            const d = await apiFetch<{ effective: Record<string, unknown> }>(`/api/projects/${project}/settings`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            setEffective(d.effective)
            toast.success('Settings saved — new runs and agents use them immediately')
        } catch (e) {
            toast.error(describeApiError(e))
        } finally {
            setSaving(false)
        }
    }

    if (!loaded) {
        return loadError ? (
            <ErrorState message="Couldn’t load project settings." onRetry={() => void load()} />
        ) : (
            <LoadingState />
        )
    }

    const eff = (k: string) => String(effective[k] ?? '—')

    return (
        <div className="taskforge-page">
            <tc-helper-text text={helpTexts.settings.intro} />

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Run defaults
                </tc-heading>
                <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                    <tc-stack direction="horizontal" gap="1rem" wrap align="flex-end">
                        <div style={{ minWidth: 220 }}>
                            <Sel label={`Default model (env: ${eff('defaultModel')})`} value={defaultModel} onChange={setDefaultModel}>
                                <tc-option value="">Use default</tc-option>
                                {modelOptions.map((m) => (
                                    <tc-option key={m.value} value={m.value}>
                                        {m.label}
                                    </tc-option>
                                ))}
                            </Sel>
                        </div>
                        <div style={{ minWidth: 220 }}>
                            <Sel
                                label={`Default account (default: ${effective.defaultAccount ? String(effective.defaultAccount) : 'ambient login'})`}
                                value={defaultAccount}
                                onChange={setDefaultAccount}
                            >
                                <tc-option value="">Use default</tc-option>
                                {accounts.map((a) => (
                                    <tc-option key={a.alias} value={a.alias}>
                                        {a.alias}
                                        {a.label ? ` — ${a.label}` : ''}
                                    </tc-option>
                                ))}
                            </Sel>
                        </div>
                        <TriSel label="Warm session" value={warmSession} onChange={setWarmSession} />
                        <TriSel label="Commit after task" value={commitAfter} onChange={setCommitAfter} />
                        <Sel label="Commit message" value={commitMode} onChange={setCommitMode}>
                            <tc-option value="">Use default</tc-option>
                            <tc-option value="taskname">Task name</tc-option>
                            <tc-option value="ai">AI-generated</tc-option>
                        </Sel>
                        <div style={{ minWidth: 200 }}>
                            <Sel label="Commit model" value={commitModel} onChange={setCommitModel}>
                                <tc-option value="">Use default</tc-option>
                                {modelOptions.map((m) => (
                                    <tc-option key={m.value} value={m.value}>
                                        {m.label}
                                    </tc-option>
                                ))}
                            </Sel>
                        </div>
                    </tc-stack>
                    <tc-divider label="Branch & push" />
                    <tc-stack direction="horizontal" gap="1rem" wrap align="flex-end">
                        <TriSel label="Branch per run" value={branchPerRun} onChange={setBranchPerRun} />
                        <TriSel label="Push after run" value={pushAfter} onChange={setPushAfter} />
                        <TriSel label="Open PR after push" value={openPr} onChange={setOpenPr} />
                        <TriSel label="Reviewer pass" value={review} onChange={setReview} />
                    </tc-stack>
                </tc-stack>
            </tc-card>

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Knowledge &amp; usage
                </tc-heading>
                <tc-stack direction="horizontal" gap="1rem" wrap align="flex-end" style={{ padding: '1rem' }}>
                    <TriSel label="Knowledge auto-update" value={knowledgeAuto} onChange={setKnowledgeAuto} />
                    <div style={{ maxWidth: 240 }}>
                        <tc-number-input
                            ref={usageRef}
                            label={`Usage-gate threshold % (env: ${eff('usageGateThreshold')})`}
                            min={1}
                            max={100}
                            value={usageGate}
                        />
                    </div>
                </tc-stack>
            </tc-card>

            <tc-card>
                <tc-heading slot="header" as="h3">
                    Notifications
                </tc-heading>
                <tc-stack gap="0.75rem" style={{ padding: '1rem' }}>
                    <tc-helper-text text={helpTexts.settings.notify} />
                    <Chk
                        label="Override the global event selection for this project"
                        checked={notifyOverridden}
                        onChange={setNotifyOverridden}
                    />
                    {notifyOverridden && (
                        <tc-stack direction="horizontal" gap="1rem" wrap align="flex-end" style={{ paddingTop: '0.25rem' }}>
                            {NOTIFY_EVENTS.map((ev) => (
                                <Chk
                                    key={ev}
                                    label={ev}
                                    inline
                                    checked={notifyEvents.has(ev)}
                                    onChange={(checked) =>
                                        setNotifyEvents((prev) => {
                                            const next = new Set(prev)
                                            if (checked) next.add(ev)
                                            else next.delete(ev)
                                            return next
                                        })
                                    }
                                />
                            ))}
                        </tc-stack>
                    )}
                    <tc-input
                        ref={webhookRef}
                        label="Outbound JSON webhook URL (blank = env default)"
                        placeholder="https://ntfy.sh/my-topic"
                        value={webhookUrl}
                    />
                </tc-stack>
            </tc-card>

            <tc-stack direction="horizontal" gap="0.75rem" wrap align="center">
                <tc-button variant="primary" loading={saving || undefined} disabled={saving || undefined} onClick={() => void save()}>
                    Save settings
                </tc-button>
                <tc-text variant="muted">Empty / “Use default” values fall back to the environment configuration.</tc-text>
            </tc-stack>
        </div>
    )
}
