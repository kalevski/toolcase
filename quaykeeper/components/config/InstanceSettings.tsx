'use client'

import { useCallback, useMemo, useState } from 'react'
import type { Instance } from '@/server/domain/types'
import { useTc, detailValue } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'
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

    // The agent-server URL for the usage guide — the owner-configured "Instance
    // config URL" setting. Until it's set, fall back to this origin's hostname on
    // the default agent port so the snippet is still a working starting point.
    const branding = useBranding()
    const fallbackAgentUrl =
        typeof window !== 'undefined'
            ? `${window.location.protocol}//${window.location.hostname}:4101`
            : 'https://config.example.com'
    const agentUrl = branding.instanceUrl || fallbackAgentUrl

    const envSnippet = [
        `QUAYKEEPER_URL=${agentUrl}`,
        `QUAYKEEPER_INSTANCE=${instance.name}`,
        `QUAYKEEPER_SECRET=<the minted secret — from a Docker/orchestrator secret, never baked into the image>`,
    ].join('\n')

    const entrypointSnippet = [
        `# Dockerfile — no Quaykeeper code baked into the app image; the bootstrap script`,
        `# downloads the matching quaykeeper-client binary at boot and execs your app`,
        `ENTRYPOINT ["sh", "-c", "wget -qO- \\"$QUAYKEEPER_URL/v1/install.sh\\" | sh -s -- exec -- \\"$@\\"", "sh"]`,
        `CMD ["./my-app", "--serve"]`,
    ].join('\n')

    const dockerRunSnippet = [
        `# docker run — same bootstrap against a stock image, no Dockerfile: override`,
        `# the entrypoint to fetch install.sh, which downloads the client and execs your app`,
        `docker run -d \\`,
        `    -e QUAYKEEPER_URL=${agentUrl} \\`,
        `    -e QUAYKEEPER_INSTANCE=${instance.name} \\`,
        `    -e QUAYKEEPER_SECRET="$QUAYKEEPER_SECRET" \\`,
        `    --entrypoint /bin/sh \\`,
        `    my-app:latest \\`,
        `    -c 'wget -qO- "$QUAYKEEPER_URL/v1/install.sh" | sh -s -- exec -- ./my-app --serve'`,
    ].join('\n')

    const modesSnippet = [
        `quaykeeper-client exec -- ./app --serve        # fetch once, inject as env, exec (PID-1 handoff)`,
        `quaykeeper-client write --format dotenv --out /app/.env    # materialize to a file`,
        `quaykeeper-client serve --addr 127.0.0.1:9000 --interval 30s   # loopback sidecar: /env /flags /config`,
    ].join('\n')

    const goSnippet = [
        `import quaykeeper "github.com/kalevski/quaykeeper-client"`,
        ``,
        `c := quaykeeper.New(quaykeeper.FromEnv())          // reads QUAYKEEPER_URL / QUAYKEEPER_INSTANCE / QUAYKEEPER_SECRET`,
        `env, _ := c.FetchEnv(ctx)                // map[string]string, secrets resolved server-side`,
        `flags, _ := c.FetchFlags(ctx)            // map[string]quaykeeper.Flag{ Enabled }`,
        `c.Watch(ctx, 30*time.Second, func(s quaykeeper.Snapshot) { /* fires only on change */ })`,
    ].join('\n')

    return (
        <>
            <tc-section-card title="Details" icon="pencil">
                <div className="quaykeeper-admin-section">
                    {detailsError && <tc-banner variant="error">{detailsError}</tc-banner>}
                    <div className="quaykeeper-form-grid">
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
                    <div className="quaykeeper-list-actions">
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
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {instance.hasKey ? 'A fetch key is set.' : 'No fetch key minted yet.'} Minting/rotating shows the
                        secret once — it is never recoverable afterwards.
                    </p>
                    {keyError && <tc-banner variant="error">{keyError}</tc-banner>}
                    {mintedSecret && (
                        <>
                            <tc-banner variant="warning">Copy this now — it will not be shown again.</tc-banner>
                            <tc-code-snippet code={mintedSecret} language="bash" title="Fetch secret" show-copy-button="" />
                        </>
                    )}
                    <div className="quaykeeper-list-actions">
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

                    <div className="quaykeeper-key-guide">
                        <div className="quaykeeper-form-group-title">Using the key (Go client)</div>
                        <p className="quaykeeper-admin-hint">
                            The key authenticates <code>quaykeeper-client</code> — the standard-library-only Go binary served
                            by the agent server (the “Instance config URL” in admin Settings) — which pulls the resolved
                            variables/flags at container boot. Configure the target container with three env vars:
                        </p>
                        <tc-code-snippet code={envSnippet} language="bash" title="Environment" show-copy-button="" />
                        <p className="quaykeeper-admin-hint">
                            Bootstrap it as the container entrypoint (downloads the matching binary from{' '}
                            <code>/v1/client/&lt;os&gt;/&lt;arch&gt;</code>, then execs your app with the
                            config injected as env — fails closed if the fetch fails):
                        </p>
                        <tc-code-snippet code={entrypointSnippet} language="bash" title="Dockerfile" show-copy-button="" />
                        <p className="quaykeeper-admin-hint">
                            Or run a stock image the same way without a custom Dockerfile — override the entrypoint at{' '}
                            <code>docker run</code> time (export the fetch secret in your shell first so it is never baked
                            into the image or the command text):
                        </p>
                        <tc-code-snippet code={dockerRunSnippet} language="bash" title="docker run" show-copy-button="" />
                        <p className="quaykeeper-admin-hint">Or run one of the three modes directly:</p>
                        <tc-code-snippet code={modesSnippet} language="bash" title="Modes" show-copy-button="" />
                        <p className="quaykeeper-admin-hint">Or embed it as a library in your Go service:</p>
                        <tc-code-snippet code={goSnippet} language="bash" title="Go" show-copy-button="" />
                    </div>
                </div>
            </tc-section-card>

            <tc-section-card title="Danger zone" icon="triangle-alert">
                <div className="quaykeeper-admin-section quaykeeper-danger-zone">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        Deleting an instance removes its tags, variables, and flags. This cannot be undone.
                    </p>
                    <div className="quaykeeper-list-actions">
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
