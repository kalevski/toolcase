'use client'

import { useCallback, useMemo, useState } from 'react'
import {
    buildDockerRun,
    normalizeSpec,
    validateSpec,
    type DockerRunSpec,
    type InjectTool,
    type PortMapping,
    type PullPolicy,
    type RestartPolicy,
    type VolumeMapping,
} from '@/server/domain/docker-run'
import type { DockerSnippet, Instance } from '@/server/domain/types'
import { IconBtn } from '@/lib/action-icons'
import { callApi } from '@/components/config/shared'
import { FormModal, FormGroup } from '@/components/FormModal'
import { CheckField, SelectField, SwitchField, TextField, type SelectOption } from '@/components/fields'
import { useToast } from '@/components/Toast'

// The docker-run snippet builder — a FormModal that constructs a `docker run`
// command from structured inputs, with a live preview rendered by the SAME pure
// `buildDockerRun` the list page uses. The Quaykeeper-variables section wires the
// optional injection: pick a Config instance and the generated command rewrites
// the entrypoint inline to fetch that instance's resolved env from the agent
// server at boot (see domain/docker-run.ts). The fetch secret is never part of
// the snippet — the command references `$QUAYKEEPER_SECRET` from the operator's shell.

const RESTART_OPTIONS: SelectOption[] = [
    { value: '', label: 'None (default)' },
    { value: 'on-failure', label: 'on-failure' },
    { value: 'always', label: 'always' },
    { value: 'unless-stopped', label: 'unless-stopped' },
]

const PULL_OPTIONS: SelectOption[] = [
    { value: '', label: 'missing (default)' },
    { value: 'always', label: 'always' },
    { value: 'never', label: 'never' },
]

const PROTOCOL_OPTIONS: SelectOption[] = [
    { value: 'tcp', label: 'tcp' },
    { value: 'udp', label: 'udp' },
]

const TOOL_OPTIONS: SelectOption[] = [
    { value: 'curl', label: 'curl (most images)' },
    { value: 'wget', label: 'wget (alpine / busybox)' },
]

interface Draft {
    name: string
    description: string
    instanceId: string
    spec: DockerRunSpec
}

function draftFor(snippet: DockerSnippet | null): Draft {
    return {
        name: snippet?.name ?? '',
        description: snippet?.description ?? '',
        instanceId: snippet?.instanceId ?? '',
        spec: normalizeSpec(snippet?.spec),
    }
}

export function SnippetEditor({
    snippet,
    instances,
    agentUrl,
    onClose,
    onSaved,
}: {
    /** The snippet being edited, or null to create a new one. */
    snippet: DockerSnippet | null
    instances: Instance[]
    /** Agent-server base URL used for the preview (admin "Instance config URL"). */
    agentUrl: string
    onClose: () => void
    onSaved: () => void
}) {
    const toast = useToast()
    const [draft, setDraft] = useState<Draft>(() => draftFor(snippet))
    const [error, setError] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

    const patch = (p: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...p }))
    const patchSpec = (p: Partial<DockerRunSpec>) =>
        setDraft((prev) => ({ ...prev, spec: { ...prev.spec, ...p } }))

    const spec = draft.spec

    const instanceOptions: SelectOption[] = useMemo(
        () => instances.map((i) => ({ value: i.id, label: i.name })),
        [instances],
    )
    const selectedInstance = instances.find((i) => i.id === draft.instanceId)

    // ── dynamic rows ─────────────────────────────────────────────────────────

    const patchPort = (i: number, p: Partial<PortMapping>) =>
        patchSpec({ ports: spec.ports.map((row, idx) => (idx === i ? { ...row, ...p } : row)) })
    const patchVolume = (i: number, p: Partial<VolumeMapping>) =>
        patchSpec({ volumes: spec.volumes.map((row, idx) => (idx === i ? { ...row, ...p } : row)) })
    const patchEnv = (i: number, p: Partial<{ key: string; value: string }>) =>
        patchSpec({ env: spec.env.map((row, idx) => (idx === i ? { ...row, ...p } : row)) })
    const removeAt = <T,>(rows: T[], i: number): T[] => rows.filter((_, idx) => idx !== i)

    // ── injection ────────────────────────────────────────────────────────────

    const setInject = (on: boolean) => {
        if (on) {
            patchSpec({ inject: { tool: 'curl' }, entrypoint: '' })
        } else {
            setDraft((prev) => ({ ...prev, instanceId: '', spec: { ...prev.spec, inject: null } }))
        }
    }

    // ── live preview ─────────────────────────────────────────────────────────

    const preview = useMemo(
        () =>
            buildDockerRun(normalizeSpec(spec), {
                instanceName: selectedInstance?.name,
                agentUrl,
            }),
        [spec, selectedInstance, agentUrl],
    )

    // ── save ─────────────────────────────────────────────────────────────────

    const save = useCallback(async () => {
        if (busy) return
        const name = draft.name.trim()
        if (!name) {
            setError('A snippet needs a name.')
            return
        }
        const normalized = normalizeSpec(draft.spec)
        const errors = validateSpec(normalized, draft.instanceId !== '')
        if (errors.length) {
            setError(errors.join(' '))
            return
        }
        setBusy(true)
        setError(null)
        const payload = {
            name,
            description: draft.description.trim() || undefined,
            spec: normalized,
            instanceId: draft.instanceId || null,
        }
        const res = snippet
            ? await callApi(`/api/snippets/${encodeURIComponent(snippet.id)}`, 'PATCH', payload)
            : await callApi('/api/snippets', 'POST', payload)
        setBusy(false)
        if (!res.ok) {
            setError(`Couldn’t save “${name}”: ${res.message}`)
            return
        }
        toast.show(`Saved “${name}”.`, { variant: 'success' })
        onSaved()
    }, [busy, draft, snippet, onSaved, toast])

    return (
        <FormModal
            title={snippet ? 'Edit snippet' : 'New snippet'}
            busy={busy}
            submitLabel={snippet ? 'Save changes' : 'Create snippet'}
            onSubmit={() => void save()}
            onClose={onClose}
        >
            {error && <tc-banner variant="danger">{error}</tc-banner>}

            <FormGroup title="Identity">
                <div className="quaykeeper-form-grid">
                    <TextField label="Name" placeholder="redis-cache" value={draft.name} onValue={(v) => patch({ name: v })} />
                    <TextField
                        label="Description"
                        placeholder="Optional"
                        value={draft.description}
                        onValue={(v) => patch({ description: v })}
                    />
                </div>
            </FormGroup>

            <FormGroup title="Image">
                <div className="quaykeeper-form-grid">
                    <TextField
                        label="Image"
                        placeholder="ghcr.io/acme/api"
                        help="Reference without the tag."
                        value={spec.image}
                        onValue={(v) => patchSpec({ image: v })}
                    />
                    <TextField
                        label="Tag"
                        placeholder="latest"
                        help="Tag or sha256:… digest. Empty = latest."
                        value={spec.tag}
                        onValue={(v) => patchSpec({ tag: v })}
                    />
                    <SelectField
                        label="Pull policy"
                        value={spec.pull}
                        options={PULL_OPTIONS}
                        onValue={(v) => patchSpec({ pull: v as PullPolicy })}
                    />
                </div>
            </FormGroup>

            <FormGroup title="Runtime">
                <div className="quaykeeper-form-grid">
                    <TextField
                        label="Container name"
                        placeholder="Optional — docker generates one"
                        value={spec.containerName}
                        onValue={(v) => patchSpec({ containerName: v })}
                    />
                    <TextField
                        label="Network"
                        placeholder="Optional — default bridge"
                        value={spec.network}
                        onValue={(v) => patchSpec({ network: v })}
                    />
                    <SelectField
                        label="Restart policy"
                        value={spec.restart}
                        options={RESTART_OPTIONS}
                        onValue={(v) => patchSpec({ restart: v as RestartPolicy })}
                        error={
                            spec.autoRemove && spec.restart && spec.restart !== 'no'
                                ? 'Conflicts with “Remove on exit”.'
                                : undefined
                        }
                    />
                    <TextField
                        label="Working directory"
                        placeholder="/app"
                        value={spec.workdir}
                        onValue={(v) => patchSpec({ workdir: v })}
                    />
                    <TextField
                        label="User"
                        placeholder="1000:1000"
                        help="Name, uid, or uid:gid."
                        value={spec.user}
                        onValue={(v) => patchSpec({ user: v })}
                    />
                </div>
                <div className="quaykeeper-form-switches">
                    <SwitchField
                        checked={spec.detach}
                        onChecked={(v) => patchSpec({ detach: v })}
                        label="Detached (-d)"
                        help="Run in the background."
                    />
                    <SwitchField
                        checked={spec.autoRemove}
                        onChecked={(v) => patchSpec({ autoRemove: v })}
                        label="Remove on exit (--rm)"
                        help="Delete the container when it stops."
                    />
                </div>
            </FormGroup>

            <FormGroup title="Ports">
                {spec.ports.map((p, i) => (
                    <div key={i} className="quaykeeper-snippet-map-row">
                        <TextField
                            size="sm"
                            ariaLabel={`Port mapping ${i + 1} host side`}
                            placeholder="8080 or 127.0.0.1:8080 (empty = random)"
                            value={p.host}
                            onValue={(v) => patchPort(i, { host: v })}
                        />
                        <TextField
                            size="sm"
                            ariaLabel={`Port mapping ${i + 1} container port`}
                            placeholder="80"
                            value={p.container}
                            onValue={(v) => patchPort(i, { container: v })}
                        />
                        <SelectField
                            size="sm"
                            ariaLabel={`Port mapping ${i + 1} protocol`}
                            value={p.protocol}
                            options={PROTOCOL_OPTIONS}
                            onValue={(v) => patchPort(i, { protocol: v as 'tcp' | 'udp' })}
                        />
                        <IconBtn
                            icon="remove"
                            label={`Remove port mapping ${i + 1}`}
                            danger
                            onClick={() => patchSpec({ ports: removeAt(spec.ports, i) })}
                        />
                    </div>
                ))}
                <div>
                    <tc-button
                        variant="secondary"
                        outline
                        size="sm"
                        onClick={() => patchSpec({ ports: [...spec.ports, { host: '', container: '', protocol: 'tcp' }] })}
                    >
                        Add port
                    </tc-button>
                </div>
            </FormGroup>

            <FormGroup title="Volumes">
                {spec.volumes.map((v, i) => (
                    <div key={i} className="quaykeeper-snippet-map-row">
                        <TextField
                            size="sm"
                            ariaLabel={`Volume ${i + 1} source`}
                            placeholder="/host/path or volume-name"
                            value={v.source}
                            onValue={(val) => patchVolume(i, { source: val })}
                        />
                        <TextField
                            size="sm"
                            ariaLabel={`Volume ${i + 1} target`}
                            placeholder="/container/path"
                            value={v.target}
                            onValue={(val) => patchVolume(i, { target: val })}
                        />
                        <CheckField
                            inline
                            label="read-only"
                            checked={v.readOnly}
                            onChecked={(val) => patchVolume(i, { readOnly: val })}
                        />
                        <IconBtn
                            icon="remove"
                            label={`Remove volume ${i + 1}`}
                            danger
                            onClick={() => patchSpec({ volumes: removeAt(spec.volumes, i) })}
                        />
                    </div>
                ))}
                <div>
                    <tc-button
                        variant="secondary"
                        outline
                        size="sm"
                        onClick={() =>
                            patchSpec({ volumes: [...spec.volumes, { source: '', target: '', readOnly: false }] })
                        }
                    >
                        Add volume
                    </tc-button>
                </div>
            </FormGroup>

            <FormGroup title="Environment">
                <p className="quaykeeper-admin-hint">
                    Literal values baked into the command. Use the Quaykeeper variables section below for values managed on
                    an instance.
                </p>
                {spec.env.map((e, i) => (
                    <div key={i} className="quaykeeper-snippet-map-row">
                        <TextField
                            size="sm"
                            ariaLabel={`Env var ${i + 1} key`}
                            placeholder="PORT"
                            value={e.key}
                            onValue={(v) => patchEnv(i, { key: v })}
                        />
                        <TextField
                            size="sm"
                            ariaLabel={`Env var ${i + 1} value`}
                            placeholder="8080"
                            value={e.value}
                            onValue={(v) => patchEnv(i, { value: v })}
                        />
                        <IconBtn
                            icon="remove"
                            label={`Remove env var ${i + 1}`}
                            danger
                            onClick={() => patchSpec({ env: removeAt(spec.env, i) })}
                        />
                    </div>
                ))}
                <div>
                    <tc-button
                        variant="secondary"
                        outline
                        size="sm"
                        onClick={() => patchSpec({ env: [...spec.env, { key: '', value: '' }] })}
                    >
                        Add env var
                    </tc-button>
                </div>
            </FormGroup>

            <FormGroup title="Process">
                <div className="quaykeeper-form-grid">
                    <TextField
                        label="Entrypoint"
                        placeholder="Optional — image default"
                        help={spec.inject ? 'Unavailable while injection is on (injection overrides it).' : 'Binary only; put its args in Command.'}
                        disabled={!!spec.inject}
                        value={spec.entrypoint}
                        onValue={(v) => patchSpec({ entrypoint: v })}
                    />
                    <TextField
                        label="Command"
                        placeholder="./my-app --serve"
                        help={spec.inject ? 'Required — what the bootstrap execs after loading the variables.' : 'Optional args appended after the image.'}
                        value={spec.command}
                        onValue={(v) => patchSpec({ command: v })}
                    />
                    <TextField
                        label="Extra flags"
                        placeholder="--memory 512m --cap-add NET_ADMIN"
                        help="Raw docker run flags appended verbatim."
                        value={spec.extraArgs}
                        onValue={(v) => patchSpec({ extraArgs: v })}
                    />
                </div>
            </FormGroup>

            <FormGroup title="Quaykeeper variables">
                <SwitchField
                    checked={!!spec.inject}
                    onChecked={setInject}
                    label="Inject instance variables at boot"
                    help="Rewrites the entrypoint inline: the container fetches install.sh, downloads the quaykeeper-client binary, pulls the instance's resolved variables, then execs your command."
                />
                {spec.inject && (
                    <>
                        <div className="quaykeeper-form-grid">
                            <SelectField
                                label="Instance"
                                placeholder="— pick an instance —"
                                value={draft.instanceId}
                                options={instanceOptions}
                                onValue={(v) => patch({ instanceId: v })}
                            />
                            <SelectField
                                label="Fetch tool"
                                help="Which tool fetches install.sh — whichever the image ships (it then auto-detects the binary download tool)."
                                value={spec.inject.tool}
                                options={TOOL_OPTIONS}
                                onValue={(v) => patchSpec({ inject: { tool: v as InjectTool } })}
                            />
                        </div>
                        {selectedInstance && !selectedInstance.hasKey && (
                            <tc-banner variant="warning">
                                “{selectedInstance.name}” has no fetch key minted yet — mint one in the instance’s
                                Settings tab, or the container’s fetch will fail at boot.
                            </tc-banner>
                        )}
                        <p className="quaykeeper-admin-hint">
                            The command references <code>$QUAYKEEPER_SECRET</code> — export the instance’s fetch secret in
                            your shell before running it. The secret is never stored in the snippet.
                        </p>
                    </>
                )}
            </FormGroup>

            <FormGroup title="Preview">
                <tc-code-snippet code={preview} language="bash" title="docker run" show-copy-button="" />
            </FormGroup>
        </FormModal>
    )
}
