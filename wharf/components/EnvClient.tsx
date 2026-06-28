'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiFetch, describeApiError, isAuthError, ApiError } from '@/lib/fetcher'
import { useTc, detailValue } from '@/lib/tc'
import type {
    Environment,
    EnvVar,
    EnvVarSource,
    Instance,
    ProjectDetail,
    ResolvedConfig,
    SecretMeta,
} from '@/server/domain/types'

type ExportFormat = 'dotenv' | 'json' | 'compose'

const SOURCE_OPTIONS: { value: EnvVarSource; label: string }[] = [
    { value: 'literal', label: 'literal value' },
    { value: 'secret_ref', label: 'secret reference' },
]

/** A scope is either the environment baseline or one of the env's instances. */
type Scope = { kind: 'baseline' } | { kind: 'instance'; instanceId: string }

const BASELINE_SCOPE = 'baseline'

function addError(e: unknown): string {
    if (e instanceof ApiError) {
        if (e.status === 409) return 'That key already exists in this scope.'
        if (e.status === 400)
            return 'Invalid key. Use letters, digits and underscores; must not start with a digit.'
    }
    return describeApiError(e)
}

export function EnvClient({ projectId }: { projectId: string }) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const urlEnv = searchParams.get('env')

    const [detail, setDetail] = useState<ProjectDetail | null>(null)
    const [envs, setEnvs] = useState<Environment[]>([])
    const [secrets, setSecrets] = useState<SecretMeta[]>([])
    const [bootErr, setBootErr] = useState<string | null>(null)

    const [envId, setEnvId] = useState<string | null>(null)
    const [instances, setInstances] = useState<Instance[]>([])
    const [scopeKey, setScopeKey] = useState<string>(BASELINE_SCOPE)

    const [rows, setRows] = useState<EnvVar[] | null>(null)
    const [resolved, setResolved] = useState<ResolvedConfig | null>(null)
    const [err, setErr] = useState<string | null>(null)

    const canSeeSecrets = detail ? detail.effectiveRole !== 'developer' : false

    const scope: Scope = useMemo(
        () =>
            scopeKey === BASELINE_SCOPE
                ? { kind: 'baseline' }
                : { kind: 'instance', instanceId: scopeKey },
        [scopeKey],
    )
    const selectedInstance = useMemo(
        () => (scope.kind === 'instance' ? instances.find((i) => i.id === scope.instanceId) ?? null : null),
        [scope, instances],
    )

    // ── boot: project detail + environments + secrets ─────────────────────────
    useEffect(() => {
        const ctrl = new AbortController()
        const signal = ctrl.signal
        ;(async () => {
            try {
                const d = await apiFetch<ProjectDetail>(`/api/projects/${projectId}`, { signal })
                const e = await apiFetch<Environment[]>(`/api/projects/${projectId}/environments`, { signal })
                const s = await apiFetch<SecretMeta[]>(`/api/projects/${projectId}/secrets`, { signal })
                if (signal.aborted) return
                setDetail(d)
                setEnvs(e)
                setSecrets(s)
                const initial = urlEnv && e.some((env) => env.id === urlEnv) ? urlEnv : e[0]?.id ?? null
                setEnvId(initial)
            } catch (e2) {
                if (signal.aborted) return
                setBootErr(isAuthError(e2) ? 'You don’t have access to this project.' : describeApiError(e2))
            }
        })()
        return () => ctrl.abort()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])

    // ── load instances whenever the selected environment changes ──────────────
    useEffect(() => {
        if (!envId) {
            setInstances([])
            return
        }
        const ctrl = new AbortController()
        const signal = ctrl.signal
        ;(async () => {
            try {
                const list = await apiFetch<Instance[]>(
                    `/api/projects/${projectId}/environments/${envId}/instances`,
                    { signal },
                )
                if (signal.aborted) return
                setInstances(list)
            } catch (e) {
                if (signal.aborted) return
                setErr(describeApiError(e))
            }
        })()
        // reset scope to baseline when the environment changes
        setScopeKey(BASELINE_SCOPE)
        return () => ctrl.abort()
    }, [projectId, envId])

    // ── load rows (+ resolved when an instance scope) for the current scope ───
    const loadScope = useCallback(
        async (signal?: AbortSignal) => {
            if (!envId) return
            setErr(null)
            try {
                if (scope.kind === 'baseline') {
                    const r = await apiFetch<EnvVar[]>(
                        `/api/projects/${projectId}/environments/${envId}/env`,
                        { signal },
                    )
                    if (signal?.aborted) return
                    setRows(r)
                    setResolved(null)
                } else {
                    const [r, res] = await Promise.all([
                        apiFetch<EnvVar[]>(
                            `/api/projects/${projectId}/instances/${scope.instanceId}/env/raw`,
                            { signal },
                        ),
                        apiFetch<ResolvedConfig>(
                            `/api/projects/${projectId}/instances/${scope.instanceId}/env`,
                            { signal },
                        ),
                    ])
                    if (signal?.aborted) return
                    setRows(r)
                    setResolved(res)
                }
            } catch (e) {
                if (signal?.aborted) return
                setErr(describeApiError(e))
            }
        },
        [projectId, envId, scope],
    )

    useEffect(() => {
        if (!envId) {
            setRows(null)
            setResolved(null)
            return
        }
        const ctrl = new AbortController()
        setRows(null)
        setResolved(null)
        void loadScope(ctrl.signal)
        return () => ctrl.abort()
    }, [envId, loadScope])

    // ── selectors ─────────────────────────────────────────────────────────────
    const envOptions = useMemo(() => envs.map((e) => ({ value: e.id, label: e.name })), [envs])
    const scopeOptions = useMemo(
        () => [
            { value: BASELINE_SCOPE, label: 'Environment baseline' },
            ...instances.map((i) => ({ value: i.id, label: `instance: ${i.name}` })),
        ],
        [instances],
    )

    const envSelectRef = useTc<HTMLElement>(
        useMemo(() => ({ items: envOptions.map((o) => ({ key: o.value, label: o.label })), value: envId ?? '' }), [envOptions, envId]),
        {
            'tc-change': (e: Event) => {
                const next = detailValue<string>(e) ?? ''
                setEnvId(next || null)
                if (next) router.replace(`/projects/${projectId}/env?env=${next}`)
            },
        },
    )
    const scopeSelectRef = useTc<HTMLElement>(
        useMemo(() => ({ items: scopeOptions.map((o) => ({ key: o.value, label: o.label })), value: scopeKey }), [scopeOptions, scopeKey]),
        { 'tc-change': (e: Event) => setScopeKey(detailValue<string>(e) ?? BASELINE_SCOPE) },
    )

    // ── delete / patch handlers shared by rows ────────────────────────────────
    const deleteVar = async (varId: string) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/env-vars/${varId}`, { method: 'DELETE' })
            await loadScope()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const patchVar = async (
        varId: string,
        body: { value?: string; source?: EnvVarSource; secretId?: string; description?: string; required?: boolean },
    ) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/env-vars/${varId}`, {
                method: 'PATCH',
                body: JSON.stringify(body),
            })
            await loadScope()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    // ── export (opens the endpoint for the current scope in a new tab) ─────────
    const openExport = (format: ExportFormat) => {
        if (!envId) return
        const url =
            scope.kind === 'instance'
                ? `/api/projects/${projectId}/instances/${scope.instanceId}/env/export?format=${format}`
                : `/api/projects/${projectId}/environments/${envId}/env/export?format=${format}`
        window.open(url, '_blank', 'noopener')
    }

    // ── boot states ───────────────────────────────────────────────────────────
    if (bootErr && !detail) return <tc-banner variant="error">{bootErr}</tc-banner>
    if (!detail) {
        return (
            <div className="wharf-status-line" role="status" aria-busy="true">
                <tc-spinner type="border" size="sm" /> Loading…
            </div>
        )
    }

    const isInstanceScope = scope.kind === 'instance'

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="Variable"
                icon-color="blue"
                title-text="Environment variables"
                sub="Resolved cascade — baseline → instance override"
                description={
                    `Author config at the environment baseline; instances inherit it and may override individual keys. Referenced secrets resolve at fetch time.${!canSeeSecrets ? ' Secret values are hidden for developers.' : ''}`
                }
            >
                <tc-button
                    slot="actions"
                    variant="secondary"
                    outline
                    size="sm"
                    onClick={() => router.push(`/projects/${projectId}`)}
                >
                    ← Project
                </tc-button>
            </tc-rich-page-header>

            {err && <tc-banner variant="error">{err}</tc-banner>}

            {envs.length === 0 ? (
                <tc-empty-state icon="Boxes">
                    <h2>No environments</h2>
                    <p>Create environments for this project first — env vars live per environment.</p>
                </tc-empty-state>
            ) : (
                <>
                    <tc-section-card title="Scope" icon="Layers">
                        <div className="wharf-section-body">
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <tc-extended-select ref={envSelectRef} label="Environment" style={{ flex: '1 1 14rem' }} />
                                <tc-extended-select ref={scopeSelectRef} label="Scope" style={{ flex: '1 1 16rem' }} />
                            </div>
                            {/* Export buttons for the current scope */}
                            {envId && (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                                    <span style={{ color: 'var(--tc-text-muted)', fontSize: '0.875rem' }}>
                                        Export {isInstanceScope ? selectedInstance?.name ?? 'instance' : 'baseline'}:
                                    </span>
                                    <tc-button size="sm" variant="secondary" outline onClick={() => openExport('dotenv')}>
                                        .env
                                    </tc-button>
                                    <tc-button size="sm" variant="secondary" outline onClick={() => openExport('json')}>
                                        JSON
                                    </tc-button>
                                    <tc-button size="sm" variant="secondary" outline onClick={() => openExport('compose')}>
                                        compose
                                    </tc-button>
                                    {!canSeeSecrets && (
                                        <span style={{ color: 'var(--tc-text-faint)', fontSize: '0.8125rem' }}>
                                            secret values are masked in your exports
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </tc-section-card>

                    <tc-section-card title="Variables" icon="Variable">
                        <div className="wharf-section-body">
                            {/* Add-variable form */}
                            {envId && (
                                <AddVarForm
                                    key={scopeKey}
                                    isBaseline={!isInstanceScope}
                                    secrets={secrets}
                                    canSeeSecrets={canSeeSecrets}
                                    onAdd={async (payload) => {
                                        setErr(null)
                                        try {
                                            await apiFetch(`/api/projects/${projectId}/env-vars`, {
                                                method: 'POST',
                                                body: JSON.stringify({
                                                    environmentId: envId,
                                                    instanceId: isInstanceScope ? (scope as { instanceId: string }).instanceId : null,
                                                    ...payload,
                                                }),
                                            })
                                            await loadScope()
                                            return null
                                        } catch (e) {
                                            const msg = addError(e)
                                            setErr(msg)
                                            return msg
                                        }
                                    }}
                                />
                            )}

                            {/* Rows for the current scope */}
                            {rows === null ? (
                                <div className="wharf-status-line" role="status" aria-busy="true">
                                    <tc-spinner type="border" size="sm" /> Loading…
                                </div>
                            ) : rows.length === 0 ? (
                                <tc-empty-state icon="ListChecks">
                                    <h2>No variables in this scope</h2>
                                    <p>
                                        {isInstanceScope
                                            ? 'This instance has no overrides yet — it inherits the environment baseline.'
                                            : 'Add a baseline variable above.'}
                                    </p>
                                </tc-empty-state>
                            ) : (
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Key</th>
                                            <th>Value</th>
                                            <th>Description</th>
                                            {!isInstanceScope && <th>Required</th>}
                                            <th style={{ textAlign: 'right' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row) => (
                                            <VarRow
                                                key={row.id}
                                                row={row}
                                                isBaseline={!isInstanceScope}
                                                onDelete={() => deleteVar(row.id)}
                                                onSave={(body) => patchVar(row.id, body)}
                                                onToggleRequired={() =>
                                                    patchVar(row.id, { required: !row.required })
                                                }
                                            />
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </tc-section-card>

                    {/* Resolved panel — only for an instance scope */}
                    {isInstanceScope && (
                        <tc-section-card title="Resolved" icon="ListChecks">
                            <div className="wharf-section-body">
                                <ResolvedPanel resolved={resolved} neverFetched={!selectedInstance?.lastFetchAt} />
                            </div>
                        </tc-section-card>
                    )}
                </>
            )}
        </div>
    )
}

// ── Resolved config panel ─────────────────────────────────────────────────────

function ResolvedPanel({
    resolved,
    neverFetched,
}: {
    resolved: ResolvedConfig | null
    neverFetched: boolean
}) {
    return (
        <>
            {resolved === null ? (
                <div className="wharf-status-line" role="status" aria-busy="true">
                    <tc-spinner type="border" size="sm" /> Resolving…
                </div>
            ) : (
                <>
                    {resolved.missingRequired.length > 0 && (
                        <tc-banner variant="warning">
                            Missing required: {resolved.missingRequired.join(', ')}
                        </tc-banner>
                    )}
                    {neverFetched && (
                        <div style={{ color: 'var(--tc-text-faint)', fontSize: '0.8125rem' }}>
                            This instance has never fetched its config — nothing is marked pending yet.
                        </div>
                    )}
                    {resolved.env.length === 0 ? (
                        <div style={{ color: 'var(--tc-text-faint)' }}>No keys resolve for this instance.</div>
                    ) : (
                        <ul
                            style={{
                                listStyle: 'none',
                                margin: 0,
                                padding: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                            }}
                        >
                            {resolved.env.map((entry) => {
                                const pending = !neverFetched && entry.pending
                                return (
                                    <li
                                        key={entry.key}
                                        className={pending ? 'wharf-mono wharf-pending' : 'wharf-mono'}
                                        title={
                                            pending
                                                ? 'edited — not yet fetched by this instance'
                                                : undefined
                                        }
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.25rem 0.5rem',
                                            fontSize: '0.8125rem',
                                        }}
                                    >
                                        <span style={{ fontWeight: 600 }}>{entry.key}</span>
                                        <span>=</span>
                                        {entry.masked ? (
                                            <span style={{ color: 'var(--tc-text-faint)', fontStyle: 'italic' }}>
                                                hidden
                                            </span>
                                        ) : (
                                            <span style={{ wordBreak: 'break-all' }}>{entry.value}</span>
                                        )}
                                        {entry.source === 'secret_ref' && (
                                            <tc-badge variant="secondary">secret</tc-badge>
                                        )}
                                        {pending && <tc-badge variant="warning">pending</tc-badge>}
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </>
            )}
        </>
    )
}

// ── Add-variable form ──────────────────────────────────────────────────────────

function AddVarForm({
    isBaseline,
    secrets,
    canSeeSecrets,
    onAdd,
}: {
    isBaseline: boolean
    secrets: SecretMeta[]
    canSeeSecrets: boolean
    onAdd: (payload: {
        key: string
        source: EnvVarSource
        value?: string
        secretId?: string
        description?: string
        required?: boolean
    }) => Promise<string | null>
}) {
    const [key, setKey] = useState('')
    const [source, setSource] = useState<EnvVarSource>('literal')
    const [value, setValue] = useState('')
    const [secretId, setSecretId] = useState('')
    const [desc, setDesc] = useState('')
    const [required, setRequired] = useState(false)

    const keyRef = useRef(key)
    keyRef.current = key
    const valueRef = useRef(value)
    valueRef.current = value
    const secretIdRef = useRef(secretId)
    secretIdRef.current = secretId
    const descRef = useRef(desc)
    descRef.current = desc
    const sourceRef = useRef(source)
    sourceRef.current = source
    const requiredRef = useRef(required)
    requiredRef.current = required

    const keyTc = useTc<HTMLElement>(
        useMemo(() => ({ value: key }), [key]),
        { 'tc-change': (e: Event) => setKey(detailValue<string>(e) ?? '') },
    )
    const sourceTc = useTc<HTMLElement>(
        useMemo(() => ({ items: SOURCE_OPTIONS.map((o) => ({ key: o.value, label: o.label })), value: source }), [source]),
        { 'tc-change': (e: Event) => setSource((detailValue<string>(e) as EnvVarSource) ?? 'literal') },
    )
    const valueTc = useTc<HTMLElement>(
        useMemo(() => ({ value }), [value]),
        { 'tc-change': (e: Event) => setValue(detailValue<string>(e) ?? '') },
    )
    const secretOptions = useMemo(
        () => secrets.map((s) => ({ value: s.id, label: s.key })),
        [secrets],
    )
    const secretTc = useTc<HTMLElement>(
        useMemo(() => ({ items: secretOptions.map((o) => ({ key: o.value, label: o.label })), value: secretId }), [secretOptions, secretId]),
        { 'tc-change': (e: Event) => setSecretId(detailValue<string>(e) ?? '') },
    )
    const descTc = useTc<HTMLElement>(
        useMemo(() => ({ value: desc }), [desc]),
        { 'tc-change': (e: Event) => setDesc(detailValue<string>(e) ?? '') },
    )

    const submit = async () => {
        const k = keyRef.current.trim()
        if (!k) return
        const src = sourceRef.current
        if (src === 'literal') {
            const msg = await onAdd({
                key: k,
                source: 'literal',
                value: valueRef.current,
                description: descRef.current.trim() || undefined,
                required: isBaseline ? requiredRef.current : undefined,
            })
            if (msg) return
        } else {
            if (!secretIdRef.current) return
            const msg = await onAdd({
                key: k,
                source: 'secret_ref',
                secretId: secretIdRef.current,
                description: descRef.current.trim() || undefined,
                required: isBaseline ? requiredRef.current : undefined,
            })
            if (msg) return
        }
        setKey('')
        setValue('')
        setSecretId('')
        setDesc('')
        setRequired(false)
        setSource('literal')
    }

    const canSubmit = key.trim().length > 0 && (source === 'literal' || secretId.length > 0)

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                paddingBottom: '1rem',
                marginBottom: '0.5rem',
                borderBottom: '1px solid var(--tc-border)',
            }}
        >
            <strong>Add variable</strong>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <tc-input ref={keyTc} label="Key" placeholder="e.g. DATABASE_URL" style={{ flex: '1 1 14rem' }} />
                <tc-extended-select ref={sourceTc} label="Source" style={{ flex: '0 1 12rem' }} />
                {source === 'literal' ? (
                    <tc-input
                        ref={valueTc}
                        label="Value"
                        placeholder="e.g. postgres://${DB_HOST}/app"
                        style={{ flex: '1 1 16rem' }}
                    />
                ) : (
                    <tc-extended-select
                        ref={secretTc}
                        label="Secret"
                        placeholder="Pick a secret…"
                        style={{ flex: '1 1 16rem' }}
                    />
                )}
                <tc-input ref={descTc} label="Description" placeholder="optional" style={{ flex: '1 1 12rem' }} />
            </div>
            <div>
                <tc-button variant="primary" onClick={submit} disabled={!canSubmit}>
                    Add
                </tc-button>
            </div>
            {isBaseline && (
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                    <input
                        type="checkbox"
                        checked={required}
                        onChange={(e) => setRequired(e.target.checked)}
                    />
                    Required for every instance
                </label>
            )}
            {source === 'literal' && (
                <span style={{ color: 'var(--tc-text-faint)', fontSize: '0.8125rem' }}>
                    Templating: <code>{'${VAR}'}</code> in a literal value is expanded against other resolved
                    keys at fetch time.
                </span>
            )}
            {source === 'secret_ref' && !canSeeSecrets && (
                <span style={{ color: 'var(--tc-text-faint)', fontSize: '0.8125rem' }}>
                    You can reference a secret by key; its value stays hidden from you and resolves at fetch
                    time.
                </span>
            )}
        </div>
    )
}

// ── One authoring row ──────────────────────────────────────────────────────────

function VarRow({
    row,
    isBaseline,
    onDelete,
    onSave,
    onToggleRequired,
}: {
    row: EnvVar
    isBaseline: boolean
    onDelete: () => void
    onSave: (body: { value?: string; description?: string }) => void
    onToggleRequired: () => void
}) {
    const [editing, setEditing] = useState(false)
    const [eValue, setEValue] = useState(row.value ?? '')
    const [eDesc, setEDesc] = useState(row.description ?? '')
    const eValueRef = useRef(eValue)
    eValueRef.current = eValue
    const eDescRef = useRef(eDesc)
    eDescRef.current = eDesc

    const eValueTc = useTc<HTMLElement>(
        useMemo(() => ({ value: eValue }), [eValue]),
        { 'tc-change': (e: Event) => setEValue(detailValue<string>(e) ?? '') },
    )
    const eDescTc = useTc<HTMLElement>(
        useMemo(() => ({ value: eDesc }), [eDesc]),
        { 'tc-change': (e: Event) => setEDesc(detailValue<string>(e) ?? '') },
    )

    const isSecret = row.source === 'secret_ref'
    const colSpan = isBaseline ? 5 : 4

    const startEdit = () => {
        setEValue(row.value ?? '')
        setEDesc(row.description ?? '')
        setEditing(true)
    }
    const save = () => {
        const body: { value?: string; description?: string } = { description: eDescRef.current }
        if (!isSecret) body.value = eValueRef.current
        onSave(body)
        setEditing(false)
    }

    return (
        <>
            <tr>
                <td>
                    <code style={{ fontWeight: 600 }}>{row.key}</code>
                </td>
                <td>
                    {isSecret ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                            <span aria-hidden style={{ color: 'var(--tc-text-faint)' }}>
                                🔒
                            </span>
                            <code>{row.secretKey ?? '—'}</code>
                            <span style={{ color: 'var(--tc-text-faint)', fontSize: '0.8125rem' }}>
                                secret — value hidden
                            </span>
                        </span>
                    ) : (
                        <code style={{ wordBreak: 'break-all' }}>{row.value ?? ''}</code>
                    )}
                </td>
                <td style={{ color: 'var(--tc-text-muted)' }}>{row.description ?? '—'}</td>
                {isBaseline && (
                    <td>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="checkbox" checked={row.required} onChange={onToggleRequired} />
                            {row.required ? <tc-badge variant="warning">required</tc-badge> : <span style={{ color: 'var(--tc-text-faint)' }}>optional</span>}
                        </label>
                    </td>
                )}
                <td
                    style={{
                        textAlign: 'right',
                        display: 'flex',
                        gap: '0.5rem',
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                    }}
                >
                    <tc-button size="sm" variant="secondary" outline onClick={editing ? () => setEditing(false) : startEdit}>
                        {editing ? 'Cancel' : 'Edit'}
                    </tc-button>
                    <tc-button size="sm" variant="danger" outline onClick={onDelete}>
                        Delete
                    </tc-button>
                </td>
            </tr>
            {editing && (
                <tr>
                    <td colSpan={colSpan}>
                        <div style={{ padding: '0.5rem 0' }}>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '0.5rem',
                                    alignItems: 'flex-end',
                                    flexWrap: 'wrap',
                                }}
                            >
                                {!isSecret && (
                                    <tc-input
                                        ref={eValueTc}
                                        label="Value"
                                        placeholder="e.g. postgres://${DB_HOST}/app"
                                        style={{ flex: '1 1 16rem' }}
                                    />
                                )}
                                <tc-input ref={eDescTc} label="Description" placeholder="optional" style={{ flex: '1 1 12rem' }} />
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <tc-button size="sm" variant="primary" onClick={save}>
                                    Save
                                </tc-button>
                            </div>
                        </div>
                        {!isSecret && (
                            <span style={{ color: 'var(--tc-text-faint)', fontSize: '0.8125rem' }}>
                                <code>{'${VAR}'}</code> templating is supported in literal values.
                            </span>
                        )}
                    </td>
                </tr>
            )}
        </>
    )
}
