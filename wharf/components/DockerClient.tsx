'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { apiFetch, describeApiError, ApiError, isAuthError } from '@/lib/fetcher'
import { useTc, detailValue } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'
import type {
    DockerCommand,
    DockerSpec,
    DockerKv,
    DockerPortMapping,
    DockerVolumeMapping,
    DockerLifecycle,
    DockerRenderFormat,
    Environment,
    Instance,
    ProjectDetail,
} from '@/server/domain/types'

// Mirror of the service's defaultDockerSpec() — kept here so a fresh form has
// sensible defaults without a server round-trip. The server is the source of
// truth for what gets persisted (this is purely an editor seed).
function blankSpec(): DockerSpec {
    return {
        image: '',
        tag: '',
        containerName: '',
        detach: true,
        tty: false,
        removeOnExit: false,
        pull: 'missing',
        restart: 'unless-stopped',
        network: undefined,
        ports: [],
        volumes: [],
        envInline: [],
        envSource: 'none',
        labels: [],
        memory: undefined,
        cpus: undefined,
        user: undefined,
        workdir: undefined,
        entrypoint: null,
        command: [],
        extraArgs: undefined,
    }
}

interface InstanceOption {
    value: string
    label: string
}

export function DockerClient({ projectId }: { projectId: string }) {
    const branding = useBranding()
    const [detail, setDetail] = useState<ProjectDetail | null>(null)
    const [commands, setCommands] = useState<DockerCommand[]>([])
    const [instanceOptions, setInstanceOptions] = useState<InstanceOption[]>([])
    const [err, setErr] = useState<string | null>(null)

    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [name, setName] = useState('')
    const [spec, setSpec] = useState<DockerSpec>(blankSpec())
    const [instanceId, setInstanceId] = useState<string>('')

    const [lifecycle, setLifecycle] = useState<DockerLifecycle>('run')
    const [format, setFormat] = useState<DockerRenderFormat>('sh')
    const [rendered, setRendered] = useState<string | null>(null)
    const [renderErr, setRenderErr] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<DockerCommand | null>(null)

    const canManage = detail ? detail.effectiveRole !== 'developer' : false

    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const d = await apiFetch<ProjectDetail>(`/api/projects/${projectId}`, { signal })
                if (signal?.aborted) return
                setDetail(d)
                if (d.effectiveRole === 'developer') return
                const cmds = await apiFetch<DockerCommand[]>(
                    `/api/projects/${projectId}/docker-commands`,
                    { signal },
                )
                const envs = await apiFetch<Environment[]>(
                    `/api/projects/${projectId}/environments`,
                    { signal },
                )
                const perEnv = await Promise.all(
                    envs.map((env) =>
                        apiFetch<Instance[]>(
                            `/api/projects/${projectId}/environments/${env.id}/instances`,
                            { signal },
                        ).then((list) => [env, list] as const),
                    ),
                )
                if (signal?.aborted) return
                const opts: InstanceOption[] = []
                for (const [env, list] of perEnv) {
                    for (const inst of list) {
                        opts.push({ value: inst.id, label: `${env.name} / ${inst.name}` })
                    }
                }
                setCommands(cmds)
                setInstanceOptions(opts)
            } catch (e) {
                if (signal?.aborted) return
                setErr(isAuthError(e) ? 'You don’t have access to this project.' : describeApiError(e))
            }
        },
        [projectId],
    )

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    // ── form helpers ────────────────────────────────────────────────────────
    const editSpec = (patch: Partial<DockerSpec>) => setSpec((s) => ({ ...s, ...patch }))

    const newCommand = () => {
        setSelectedId(null)
        setName('')
        setSpec(blankSpec())
        setInstanceId('')
        setRendered(null)
        setRenderErr(null)
    }

    const selectCommand = (cmd: DockerCommand) => {
        setSelectedId(cmd.id)
        setName(cmd.name)
        setSpec({ ...blankSpec(), ...cmd.spec })
        setInstanceId(cmd.instanceId ?? '')
        setRendered(null)
        setRenderErr(null)
    }

    const save = async () => {
        const trimmed = name.trim()
        if (!trimmed) return
        setErr(null)
        const payload = {
            name: trimmed,
            spec,
            instanceId: instanceId || null,
        }
        try {
            if (selectedId) {
                const updated = await apiFetch<DockerCommand>(
                    `/api/projects/${projectId}/docker-commands/${selectedId}`,
                    { method: 'PATCH', body: JSON.stringify(payload) },
                )
                setSelectedId(updated.id)
            } else {
                const created = await apiFetch<DockerCommand>(
                    `/api/projects/${projectId}/docker-commands`,
                    { method: 'POST', body: JSON.stringify(payload) },
                )
                setSelectedId(created.id)
            }
            await load()
        } catch (e) {
            setErr(
                e instanceof ApiError && e.status === 409
                    ? 'A command with that name already exists.'
                    : describeApiError(e),
            )
        }
    }

    const del = async (cmdId: string) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/docker-commands/${cmdId}`, { method: 'DELETE' })
            if (selectedId === cmdId) newCommand()
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const render = async () => {
        if (!selectedId) return
        setRenderErr(null)
        setRendered(null)
        setCopied(false)
        try {
            const res = await apiFetch<{ command: string }>(
                `/api/projects/${projectId}/docker-commands/${selectedId}/render?lifecycle=${lifecycle}&format=${format}`,
            )
            setRendered(res.command)
        } catch (e) {
            if (e instanceof ApiError && e.status === 422) {
                setRenderErr('Instance env injection is available after env vars are configured.')
            } else {
                setRenderErr(describeApiError(e))
            }
        }
    }

    const copy = async () => {
        if (!rendered) return
        try {
            await navigator.clipboard.writeText(rendered)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            /* clipboard unavailable */
        }
    }

    // ── tc-* controlled inputs ────────────────────────────────────────────────
    const nameRef = useTc<HTMLElement>(
        useMemo(() => ({ value: name }), [name]),
        { 'tc-change': (e: Event) => setName(detailValue<string>(e) ?? '') },
    )

    const restartOptions = useMemo(
        () => [
            { value: 'no', label: 'no' },
            { value: 'on-failure', label: 'on-failure' },
            { value: 'always', label: 'always' },
            { value: 'unless-stopped', label: 'unless-stopped' },
        ],
        [],
    )
    const restartRef = useTc<HTMLElement>(
        useMemo(() => ({ items: restartOptions.map((o) => ({ key: o.value, label: o.label })), value: spec.restart }), [restartOptions, spec.restart]),
        { 'tc-change': (e: Event) => editSpec({ restart: (detailValue<string>(e) as DockerSpec['restart']) ?? 'unless-stopped' }) },
    )

    const pullOptions = useMemo(
        () => [
            { value: 'missing', label: 'missing' },
            { value: 'always', label: 'always' },
            { value: 'never', label: 'never' },
        ],
        [],
    )
    const pullRef = useTc<HTMLElement>(
        useMemo(() => ({ items: pullOptions.map((o) => ({ key: o.value, label: o.label })), value: spec.pull }), [pullOptions, spec.pull]),
        { 'tc-change': (e: Event) => editSpec({ pull: (detailValue<string>(e) as DockerSpec['pull']) ?? 'missing' }) },
    )

    const envSourceOptions = useMemo(
        () => [
            { value: 'none', label: 'none (inline only)' },
            { value: 'wharf', label: 'wharf (agent client injects env)' },
            { value: 'instance', label: 'instance (inline resolved env)' },
        ],
        [],
    )
    const envSourceRef = useTc<HTMLElement>(
        useMemo(() => ({ items: envSourceOptions.map((o) => ({ key: o.value, label: o.label })), value: spec.envSource }), [envSourceOptions, spec.envSource]),
        { 'tc-change': (e: Event) => editSpec({ envSource: (detailValue<string>(e) as DockerSpec['envSource']) ?? 'none' }) },
    )

    const instanceSelectOptions = useMemo(
        () => [{ value: '', label: '— none —' }, ...instanceOptions],
        [instanceOptions],
    )
    const instanceRef = useTc<HTMLElement>(
        useMemo(() => ({ items: instanceSelectOptions.map((o) => ({ key: o.value, label: o.label })), value: instanceId }), [instanceSelectOptions, instanceId]),
        { 'tc-change': (e: Event) => setInstanceId(detailValue<string>(e) ?? '') },
    )

    const lifecycleOptions = useMemo(
        () => [
            { value: 'run', label: 'run' },
            { value: 'recreate', label: 'recreate (stop + rm + run)' },
        ],
        [],
    )
    const lifecycleRef = useTc<HTMLElement>(
        useMemo(() => ({ items: lifecycleOptions.map((o) => ({ key: o.value, label: o.label })), value: lifecycle }), [lifecycleOptions, lifecycle]),
        { 'tc-change': (e: Event) => setLifecycle((detailValue<string>(e) as DockerLifecycle) ?? 'run') },
    )

    const formatOptions = useMemo(
        () => [
            { value: 'sh', label: 'shell (docker run)' },
            { value: 'compose', label: 'docker-compose' },
        ],
        [],
    )
    const formatRef = useTc<HTMLElement>(
        useMemo(() => ({ items: formatOptions.map((o) => ({ key: o.value, label: o.label })), value: format }), [formatOptions, format]),
        { 'tc-change': (e: Event) => setFormat((detailValue<string>(e) as DockerRenderFormat) ?? 'sh') },
    )

    const confirmRef = useTc<HTMLElement>(undefined, {
        'tc-confirm': () => {
            const target = pendingDelete
            setPendingDelete(null)
            if (target) void del(target.id)
        },
        'tc-cancel': () => setPendingDelete(null),
    })

    const renderModalRef = useTc<HTMLElement>(
        useMemo(() => ({ open: rendered != null }), [rendered]),
        { 'tc-hidden': () => { setRendered(null); setCopied(false) } },
    )

    const needsInstance = spec.envSource === 'wharf' || spec.envSource === 'instance'

    // ── render ────────────────────────────────────────────────────────────────
    if (err && !detail) return <tc-banner variant="error">{err}</tc-banner>
    if (!detail) {
        return (
            <div className="wharf-status-line" role="status" aria-busy="true">
                <tc-spinner type="border" size="sm" /> Loading…
            </div>
        )
    }

    if (!canManage) {
        return (
            <div className="wharf-page">
                <tc-rich-page-header
                    icon-name="Container"
                    icon-color="blue"
                    title-text="Docker run builder"
                    sub="Generate a docker run script — never executed"
                />
                <tc-banner variant="warning">
                    The Docker run builder is available to devops and owners only.
                </tc-banner>
            </div>
        )
    }

    const labelStyle: CSSProperties = {
        display: 'block',
        fontSize: '0.8125rem',
        color: 'var(--tc-text-muted)',
        marginBottom: '0.25rem',
    }
    const inputStyle: CSSProperties = { width: '100%' }
    const fieldGap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.75rem' }

    return (
        <div className="wharf-page">
            <tc-rich-page-header
                icon-name="Container"
                icon-color="blue"
                title-text="Docker run builder"
                sub="Generate a docker run script — never executed"
                description={`Generates docker run / compose text. ${branding.appName} never executes Docker.`}
            >
                <tc-button slot="actions" variant="primary" onClick={newCommand}>
                    New command
                </tc-button>
            </tc-rich-page-header>


            {err && <tc-banner variant="error">{err}</tc-banner>}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(14rem, 18rem) 1fr', gap: '1rem', alignItems: 'start' }}>
                {/* ── saved commands list ── */}
                <tc-section-card title="Saved commands" icon="ScrollText">
                    <div className="wharf-section-body">
                        {commands.length === 0 ? (
                            <p style={{ color: 'var(--tc-text-faint)', fontSize: '0.8125rem', margin: 0 }}>None yet.</p>
                        ) : (
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                {commands.map((cmd) => (
                                    <li
                                        key={cmd.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '0.5rem',
                                            padding: '0.375rem 0.5rem',
                                            background: cmd.id === selectedId ? 'var(--tc-surface-muted)' : 'transparent',
                                        }}
                                    >
                                        <button
                                            onClick={() => selectCommand(cmd)}
                                            style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--wharf-accent-strong)', font: 'inherit', padding: 0, textAlign: 'left' }}
                                        >
                                            {cmd.name}
                                        </button>
                                        <tc-button size="sm" variant="danger" outline onClick={() => setPendingDelete(cmd)}>
                                            ✕
                                        </tc-button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </tc-section-card>

                {/* ── editor + render ── */}
                <section style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* ── render panel (on top) ── */}
                    <tc-section-card title="Render" icon="Terminal">
                        <div className="wharf-section-body" style={fieldGap}>
                            {!selectedId ? (
                                <p style={{ color: 'var(--tc-text-faint)', fontSize: '0.8125rem', margin: 0 }}>
                                    Save the command first, then render it.
                                </p>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                        <div style={{ flex: '0 1 16rem' }}>
                                            <label style={labelStyle}>Lifecycle</label>
                                            <tc-extended-select ref={lifecycleRef} />
                                        </div>
                                        <div style={{ flex: '0 1 16rem' }}>
                                            <label style={labelStyle}>Format</label>
                                            <tc-extended-select ref={formatRef} />
                                        </div>
                                        <div>
                                            <tc-button variant="secondary" onClick={render}>
                                                Render
                                            </tc-button>
                                        </div>
                                    </div>
                                    {renderErr && <tc-banner variant="warning">{renderErr}</tc-banner>}
                                </>
                            )}
                        </div>
                    </tc-section-card>

                    <tc-section-card title="Command spec" icon="Container">
                        <div className="wharf-section-body" style={fieldGap}>
                            <h3 style={{ margin: 0, fontSize: '1rem' }}>{selectedId ? 'Edit command' : 'New command'}</h3>

                            <tc-input ref={nameRef} label="Command name" placeholder="e.g. api-server" style={inputStyle} />

                        <tc-divider label="Image" />

                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label style={labelStyle}>Image</label>
                                <input className="form-control" value={spec.image} placeholder="ghcr.io/acme/api" onChange={(e) => editSpec({ image: e.target.value })} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Tag</label>
                                <input className="form-control" value={spec.tag} placeholder="latest" onChange={(e) => editSpec({ tag: e.target.value })} style={inputStyle} />
                            </div>
                        </div>

                        <div>
                            <label style={labelStyle}>Container name</label>
                            <input className="form-control" value={spec.containerName} placeholder="api" onChange={(e) => editSpec({ containerName: e.target.value })} style={inputStyle} />
                        </div>

                        <tc-divider label="Runtime" />

                        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <input type="checkbox" checked={spec.detach} onChange={(e) => editSpec({ detach: e.target.checked })} />
                                detach (-d)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <input type="checkbox" checked={spec.tty} onChange={(e) => editSpec({ tty: e.target.checked })} />
                                tty (-t)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <input type="checkbox" checked={spec.removeOnExit} onChange={(e) => editSpec({ removeOnExit: e.target.checked })} />
                                remove on exit (--rm)
                            </label>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label style={labelStyle}>Restart policy</label>
                                <tc-extended-select ref={restartRef} />
                            </div>
                            <div>
                                <label style={labelStyle}>Pull policy</label>
                                <tc-extended-select ref={pullRef} />
                            </div>
                        </div>

                        <tc-divider label="Networking" />

                        <div>
                            <label style={labelStyle}>Network</label>
                            <input className="form-control" value={spec.network ?? ''} placeholder="bridge" onChange={(e) => editSpec({ network: e.target.value || undefined })} style={inputStyle} />
                        </div>

                        {/* ports */}
                        <ListEditor
                            title="Ports"
                            rows={spec.ports}
                            onChange={(ports) => editSpec({ ports })}
                            blank={(): DockerPortMapping => ({ host: 0, container: 0, protocol: 'tcp' })}
                            render={(p, set) => (
                                <>
                                    <input className="form-control" type="number" value={p.host || ''} placeholder="host" onChange={(e) => set({ ...p, host: Number(e.target.value) })} style={{ width: '6rem' }} />
                                    <span>:</span>
                                    <input className="form-control" type="number" value={p.container || ''} placeholder="container" onChange={(e) => set({ ...p, container: Number(e.target.value) })} style={{ width: '6rem' }} />
                                    <select className="form-select" value={p.protocol} onChange={(e) => set({ ...p, protocol: e.target.value as 'tcp' | 'udp' })} style={{ width: '5rem' }}>
                                        <option value="tcp">tcp</option>
                                        <option value="udp">udp</option>
                                    </select>
                                </>
                            )}
                        />

                        {/* volumes */}
                        <ListEditor
                            title="Volumes"
                            rows={spec.volumes}
                            onChange={(volumes) => editSpec({ volumes })}
                            blank={(): DockerVolumeMapping => ({ host: '', container: '', mode: 'rw' })}
                            render={(v, set) => (
                                <>
                                    <input className="form-control" value={v.host} placeholder="/host/path" onChange={(e) => set({ ...v, host: e.target.value })} style={{ flex: 1 }} />
                                    <span>:</span>
                                    <input className="form-control" value={v.container} placeholder="/container/path" onChange={(e) => set({ ...v, container: e.target.value })} style={{ flex: 1 }} />
                                    <select className="form-select" value={v.mode} onChange={(e) => set({ ...v, mode: e.target.value as 'rw' | 'ro' })} style={{ width: '5rem' }}>
                                        <option value="rw">rw</option>
                                        <option value="ro">ro</option>
                                    </select>
                                </>
                            )}
                        />

                        <tc-divider label="Environment" />

                        {/* inline env */}
                        <KvEditor title="Inline env (-e)" rows={spec.envInline} onChange={(envInline) => editSpec({ envInline })} />

                        <div>
                            <label style={labelStyle}>Env source</label>
                            <tc-extended-select ref={envSourceRef} />
                        </div>
                        {needsInstance && (
                            <div>
                                <label style={labelStyle}>Owning instance (required for {spec.envSource})</label>
                                <tc-extended-select ref={instanceRef} />
                                {spec.envSource === 'instance' && (
                                    <p style={{ margin: '0.375rem 0 0', fontSize: '0.75rem', color: 'var(--tc-text-faint)' }}>
                                        Note: rendering with resolved instance env is available after env vars are configured.
                                    </p>
                                )}
                            </div>
                        )}

                        {/* labels */}
                        <KvEditor title="Labels (-l)" rows={spec.labels} onChange={(labels) => editSpec({ labels })} />

                        <tc-divider label="Resources" />

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div>
                                <label style={labelStyle}>Memory</label>
                                <input className="form-control" value={spec.memory ?? ''} placeholder="512m" onChange={(e) => editSpec({ memory: e.target.value || undefined })} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>CPUs</label>
                                <input className="form-control" value={spec.cpus ?? ''} placeholder="1.5" onChange={(e) => editSpec({ cpus: e.target.value || undefined })} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>User</label>
                                <input className="form-control" value={spec.user ?? ''} placeholder="1000:1000" onChange={(e) => editSpec({ user: e.target.value || undefined })} style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Workdir</label>
                                <input className="form-control" value={spec.workdir ?? ''} placeholder="/app" onChange={(e) => editSpec({ workdir: e.target.value || undefined })} style={inputStyle} />
                            </div>
                        </div>

                        <tc-divider label="Command" />

                        <div>
                            <label style={labelStyle}>Command args (space-separated)</label>
                            <input
                                className="form-control"
                                value={spec.command.join(' ')}
                                placeholder="node server.js"
                                onChange={(e) => editSpec({ command: e.target.value.trim() ? e.target.value.trim().split(/\s+/) : [] })}
                                style={inputStyle}
                            />
                        </div>

                        <div>
                            <label style={labelStyle}>Extra args (appended verbatim)</label>
                            <input className="form-control" value={spec.extraArgs ?? ''} placeholder="--cap-add NET_ADMIN" onChange={(e) => editSpec({ extraArgs: e.target.value || undefined })} style={inputStyle} />
                        </div>

                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <tc-button variant="primary" onClick={save} disabled={!name.trim() || (needsInstance && !instanceId)}>
                                    {selectedId ? 'Save changes' : 'Save command'}
                                </tc-button>
                            </div>
                        </div>
                    </tc-section-card>
                </section>
            </div>

            <tc-confirm-dialog
                ref={confirmRef}
                open={pendingDelete !== null}
                eyebrow="Docker"
                dialog-title="Delete command?"
                message={
                    pendingDelete
                        ? `Delete the saved command “${pendingDelete.name}”? This cannot be undone.`
                        : ''
                }
                confirm-label="Delete command"
                cancel-label="Cancel"
                danger
            />

            <tc-modal ref={renderModalRef} title="Rendered command" size="lg" centered>
                <tc-code-snippet language="bash" title="docker" code={rendered ?? ''} />
                <tc-button slot="footer" variant="secondary" outline onClick={() => setRendered(null)}>
                    Close
                </tc-button>
                <tc-button slot="footer" variant="primary" onClick={copy}>
                    {copied ? 'Copied!' : 'Copy'}
                </tc-button>
            </tc-modal>
        </div>
    )
}

// ── small generic list editors (plain HTML; not tc-* components) ──────────────

function ListEditor<T>({
    title,
    rows,
    onChange,
    blank,
    render,
}: {
    title: string
    rows: T[]
    onChange: (rows: T[]) => void
    blank: () => T
    render: (row: T, set: (next: T) => void) => ReactNode
}) {
    const setAt = (i: number, next: T) => onChange(rows.map((r, idx) => (idx === i ? next : r)))
    const removeAt = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
    return (
        <div>
            <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--tc-text-muted)', marginBottom: '0.25rem' }}>
                {title}
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {rows.map((row, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                        {render(row, (next) => setAt(i, next))}
                        <tc-button size="sm" variant="danger" outline onClick={() => removeAt(i)}>
                            ✕
                        </tc-button>
                    </div>
                ))}
            </div>
            <tc-button size="sm" variant="secondary" outline onClick={() => onChange([...rows, blank()])}>
                Add
            </tc-button>
        </div>
    )
}

function KvEditor({
    title,
    rows,
    onChange,
}: {
    title: string
    rows: DockerKv[]
    onChange: (rows: DockerKv[]) => void
}) {
    return (
        <ListEditor
            title={title}
            rows={rows}
            onChange={onChange}
            blank={(): DockerKv => ({ key: '', value: '' })}
            render={(kv, set) => (
                <>
                    <input className="form-control" value={kv.key} placeholder="KEY" onChange={(e) => set({ ...kv, key: e.target.value })} style={{ flex: 1 }} />
                    <span>=</span>
                    <input className="form-control" value={kv.value} placeholder="value" onChange={(e) => set({ ...kv, value: e.target.value })} style={{ flex: 1 }} />
                </>
            )}
        />
    )
}
