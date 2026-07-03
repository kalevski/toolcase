'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Instance } from '@/server/domain/types'
import { useTc, detailValue } from '@/lib/tc'
import { callApi } from './shared'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TextField } from '@/components/fields'
import { useToast } from '@/components/Toast'

// Instance Settings tab (move_wharf_to_perch.md §10): rename/description/project,
// a tc-tag-input tag editor, the fetch-key panel (mint/rotate shows the secret
// once; revoke; how-to-use guide via the Go client), and the danger zone (delete).

export function InstanceSettings({
    instance,
    onChanged,
    onDeleted,
}: {
    instance: Instance
    onChanged: (next: Instance) => void
    onDeleted: () => void
}) {
    const toast = useToast()
    const [name, setName] = useState(instance.name)
    const [description, setDescription] = useState(instance.description ?? '')
    const [project, setProject] = useState(instance.project ?? '')
    const [tags, setTags] = useState<string[]>(instance.tags)
    const [savingDetails, setSavingDetails] = useState(false)
    const [detailsError, setDetailsError] = useState<string | null>(null)

    const [keyBusy, setKeyBusy] = useState(false)
    const [mintedSecret, setMintedSecret] = useState<string | null>(null)
    const [keyError, setKeyError] = useState<string | null>(null)
    const [confirmRevoke, setConfirmRevoke] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // tc-tag-input in controlled mode: `value` is set as an element *property*
    // (arrays can't pass through JSX attributes) and every change comes back on
    // the canonical tc-change event as detail.value. Tags are lowercased here to
    // match the server's TAG_PATTERN before they ever render as chips.
    const tagsRef = useTc<HTMLElement>(
        useMemo(() => ({ value: tags }), [tags]),
        {
            'tc-change': (event) => {
                const next = detailValue<string[]>(event) ?? []
                setTags([...new Set(next.map((t) => t.trim().toLowerCase()).filter(Boolean))])
            },
        },
    )

    const saveDetails = useCallback(async () => {
        if (savingDetails) return
        const trimmedName = name.trim().toLowerCase()
        if (!trimmedName) {
            setDetailsError('An instance needs a name.')
            return
        }
        setSavingDetails(true)
        setDetailsError(null)
        const res = await callApi<Instance>(`/api/instances/${instance.id}`, 'PATCH', {
            name: trimmedName,
            description: description.trim() || null,
            project: project.trim() || null,
            tags,
        })
        setSavingDetails(false)
        if (!res.ok || !res.body) {
            setDetailsError(`Couldn’t save: ${res.message}`)
            return
        }
        toast.show('Instance updated.', { variant: 'success' })
        onChanged(res.body)
    }, [savingDetails, name, description, project, tags, instance.id, onChanged, toast])

    const mintKey = useCallback(async () => {
        if (keyBusy) return
        setKeyBusy(true)
        setKeyError(null)
        const res = await callApi<{ secret: string }>(`/api/instances/${instance.id}/key`, 'POST', {})
        setKeyBusy(false)
        if (!res.ok || !res.body) {
            setKeyError(`Couldn’t mint a key: ${res.message}`)
            return
        }
        setMintedSecret(res.body.secret)
        onChanged({ ...instance, hasKey: true })
    }, [keyBusy, instance, onChanged])

    const doRevoke = useCallback(async () => {
        setConfirmRevoke(false)
        setKeyBusy(true)
        setKeyError(null)
        const res = await callApi(`/api/instances/${instance.id}/key`, 'DELETE')
        setKeyBusy(false)
        if (!res.ok) {
            setKeyError(`Couldn’t revoke the key: ${res.message}`)
            return
        }
        setMintedSecret(null)
        toast.show('Fetch key revoked.', { variant: 'success' })
        onChanged({ ...instance, hasKey: false })
    }, [instance, onChanged, toast])

    const doDelete = useCallback(async () => {
        setConfirmDelete(false)
        setDeleting(true)
        const res = await callApi(`/api/instances/${instance.id}`, 'DELETE')
        setDeleting(false)
        if (!res.ok) {
            toast.show(`Couldn’t delete “${instance.name}”: ${res.message}`, { variant: 'error' })
            return
        }
        toast.show(`Instance “${instance.name}” deleted.`, { variant: 'success' })
        onDeleted()
    }, [instance, onDeleted, toast])

    // The fetch-API origin for the usage guide. This tree only renders
    // client-side (Providers gates on custom-element registration), so
    // window is always available here.
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://perch.example.com'

    const envSnippet = [
        `PERCH_URL=${origin}`,
        `PERCH_INSTANCE=${instance.name}`,
        `PERCH_SECRET=<the minted secret — from a Docker/orchestrator secret, never baked into the image>`,
    ].join('\n')

    const entrypointSnippet = [
        `# Dockerfile — no Perch code baked into the app image; the bootstrap script`,
        `# downloads the matching perch-client binary at boot and execs your app`,
        `ENTRYPOINT ["sh", "-c", "wget -qO- \\"$PERCH_URL/api/agent/v1/install.sh\\" | sh -s -- exec -- \\"$@\\"", "sh"]`,
        `CMD ["./my-app", "--serve"]`,
    ].join('\n')

    const modesSnippet = [
        `perch-client exec -- ./app --serve        # fetch once, inject as env, exec (PID-1 handoff)`,
        `perch-client write --format dotenv --out /app/.env    # materialize to a file`,
        `perch-client serve --addr 127.0.0.1:9000 --interval 30s   # loopback sidecar: /env /flags /config`,
    ].join('\n')

    const goSnippet = [
        `import perch "github.com/kalevski/perch-client"`,
        ``,
        `c := perch.New(perch.FromEnv())          // reads PERCH_URL / PERCH_INSTANCE / PERCH_SECRET`,
        `env, _ := c.FetchEnv(ctx)                // map[string]string, secrets resolved server-side`,
        `flags, _ := c.FetchFlags(ctx)            // map[string]perch.Flag{ Enabled }`,
        `c.Watch(ctx, 30*time.Second, func(s perch.Snapshot) { /* fires only on change */ })`,
    ].join('\n')

    return (
        <>
            <tc-section-card title="Details" icon="pencil">
                <div className="perch-admin-section">
                    {detailsError && <tc-banner variant="danger">{detailsError}</tc-banner>}
                    <div className="perch-form-grid">
                        <TextField label="Name" value={name} onValue={setName} help="Lowercase letters/digits/hyphens." />
                        <TextField label="Description" value={description} onValue={setDescription} />
                        <TextField
                            label="Project"
                            value={project}
                            onValue={setProject}
                            placeholder="acme-shop"
                            help="Optional label shared across instances — one more way to group/filter."
                        />
                    </div>
                    <tc-tag-input
                        ref={tagsRef}
                        label="Tags"
                        allow-create
                        placeholder="Add a tag…"
                        help="Enter or comma adds; Backspace removes the last tag."
                    />
                    <div className="perch-list-actions">
                        <tc-button
                            variant="primary"
                            size="sm"
                            loading={savingDetails || undefined}
                            onClick={() => void saveDetails()}
                        >
                            Save changes
                        </tc-button>
                    </div>
                </div>
            </tc-section-card>

            <tc-section-card title="Fetch key" icon="key">
                <div className="perch-admin-section">
                    <p className="perch-home-lead perch-admin-hint">
                        {instance.hasKey ? 'A fetch key is set.' : 'No fetch key minted yet.'} Minting/rotating shows the
                        secret once — it is never recoverable afterwards.
                    </p>
                    {keyError && <tc-banner variant="danger">{keyError}</tc-banner>}
                    {mintedSecret && (
                        <>
                            <tc-banner variant="warning">Copy this now — it will not be shown again.</tc-banner>
                            <tc-code-snippet code={mintedSecret} language="bash" title="Fetch secret" show-copy-button="" />
                        </>
                    )}
                    <div className="perch-list-actions">
                        <tc-button
                            variant="secondary"
                            outline
                            size="sm"
                            loading={keyBusy || undefined}
                            onClick={() => void mintKey()}
                        >
                            {instance.hasKey ? 'Rotate key' : 'Mint key'}
                        </tc-button>
                        {instance.hasKey && (
                            <tc-button variant="danger" outline size="sm" onClick={() => setConfirmRevoke(true)}>
                                Revoke
                            </tc-button>
                        )}
                    </div>

                    <div className="perch-key-guide">
                        <div className="perch-form-group-title">Using the key (Go client)</div>
                        <p className="perch-admin-hint">
                            The key authenticates <code>perch-client</code> — the standard-library-only Go binary served
                            by this instance’s fetch API — which pulls the resolved variables/flags at container boot.
                            Configure the target container with three env vars:
                        </p>
                        <tc-code-snippet code={envSnippet} language="bash" title="Environment" show-copy-button="" />
                        <p className="perch-admin-hint">
                            Bootstrap it as the container entrypoint (downloads the matching binary from{' '}
                            <code>/api/agent/v1/client/&lt;os&gt;/&lt;arch&gt;</code>, then execs your app with the
                            config injected as env — fails closed if the fetch fails):
                        </p>
                        <tc-code-snippet code={entrypointSnippet} language="bash" title="Dockerfile" show-copy-button="" />
                        <p className="perch-admin-hint">Or run one of the three modes directly:</p>
                        <tc-code-snippet code={modesSnippet} language="bash" title="Modes" show-copy-button="" />
                        <p className="perch-admin-hint">Or embed it as a library in your Go service:</p>
                        <tc-code-snippet code={goSnippet} language="bash" title="Go" show-copy-button="" />
                    </div>
                </div>
            </tc-section-card>

            <tc-section-card title="Danger zone" icon="triangle-alert">
                <div className="perch-admin-section perch-danger-zone">
                    <p className="perch-home-lead perch-admin-hint">
                        Deleting an instance removes its tags, variables, and flags. This cannot be undone.
                    </p>
                    <div className="perch-list-actions">
                        <tc-button
                            variant="danger"
                            outline
                            size="sm"
                            loading={deleting || undefined}
                            onClick={() => setConfirmDelete(true)}
                        >
                            Delete instance
                        </tc-button>
                    </div>
                </div>
            </tc-section-card>

            <ConfirmDialog
                open={confirmRevoke}
                title="Revoke fetch key?"
                message="Any machine using this key immediately loses access to config fetches."
                confirmLabel="Revoke"
                danger
                onConfirm={() => void doRevoke()}
                onCancel={() => setConfirmRevoke(false)}
            />
            <ConfirmDialog
                open={confirmDelete}
                title="Delete instance?"
                message={`Delete “${instance.name}”. Its tags, variables, and flags are removed. This cannot be undone.`}
                confirmLabel="Delete"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setConfirmDelete(false)}
            />
        </>
    )
}
