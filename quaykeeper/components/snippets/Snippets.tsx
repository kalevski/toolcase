'use client'

import { useCallback, useMemo, useState } from 'react'
import type { TableColumn } from '@toolcase/web-components'
import { escapeHtml, useTc } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'
import { buildDockerRun, imageRef } from '@/server/domain/docker-run'
import type { DockerSnippet, InstanceListItem } from '@/server/domain/types'
import { iconBtnHtml } from '@/lib/action-icons'
import { ConfigPage, callApi, json, useConfigData } from '@/components/config/shared'
import { DataTable } from '@/components/DataTable'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { SnippetEditor } from './SnippetEditor'

// Docker snippets (the `/snippets` page): saved, form-built `docker run`
// commands. The list renders each recipe's command on demand (command modal),
// via the same pure `buildDockerRun` the editor's live preview uses. Snippets
// with a Config instance attached inject that instance's resolved variables at
// container boot through the inline-entrypoint bootstrap (domain/docker-run.ts).
// Maintainer access, mirroring the Config subsystem the injection reads from.

interface SnippetsData {
    snippets: DockerSnippet[]
    instances: InstanceListItem[]
}

function badge(variant: string, text: string): string {
    return `<span class="badge text-bg-${variant}">${escapeHtml(text)}</span>`
}
function muted(text: string): string {
    return `<span class="quaykeeper-admin-hint">${escapeHtml(text)}</span>`
}
function fmtDate(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

interface SnippetRow extends Record<string, unknown> {
    id: string
    name: string
    image: string
    instanceName?: string
    description?: string
    updatedAt: string
}

const SNIPPET_COLUMNS: TableColumn[] = [
    {
        key: 'name',
        header: 'Name',
        render: (row: SnippetRow) =>
            `<button type="button" class="btn btn-link p-0 quaykeeper-admin-mono" data-action="command" data-id="${escapeHtml(row.id)}">${escapeHtml(row.name)}</button>`,
    },
    {
        key: 'image',
        header: 'Image',
        render: (row: SnippetRow) => `<span class="quaykeeper-admin-mono">${escapeHtml(row.image)}</span>`,
    },
    {
        key: 'instance',
        header: 'Variables',
        render: (row: SnippetRow) => (row.instanceName ? badge('info', row.instanceName) : muted('—')),
    },
    {
        key: 'description',
        header: 'Description',
        render: (row: SnippetRow) => (row.description ? escapeHtml(row.description) : muted('—')),
    },
    { key: 'updatedAt', header: 'Updated', render: (row: SnippetRow) => escapeHtml(fmtDate(row.updatedAt)) },
    {
        key: 'actions',
        header: '',
        align: 'right',
        render: (row: SnippetRow) =>
            `<span class="quaykeeper-admin-domain-controls">` +
            iconBtnHtml({ icon: 'config', label: `Show command for ${row.name}`, data: { action: 'command', id: row.id } }) +
            iconBtnHtml({ icon: 'edit', label: `Edit ${row.name}`, data: { action: 'edit', id: row.id } }) +
            iconBtnHtml({ icon: 'remove', label: `Delete ${row.name}`, danger: true, data: { action: 'delete', id: row.id, name: row.name } }) +
            `</span>`,
    },
]

export function Snippets() {
    const fetcher = useCallback(async (): Promise<SnippetsData | null> => {
        try {
            const [snippets, instances] = await Promise.all([
                fetch('/api/snippets', { cache: 'no-store' }).then((r) => json<DockerSnippet[]>(r)),
                fetch('/api/instances', { cache: 'no-store' }).then((r) => json<InstanceListItem[]>(r)),
            ])
            return { snippets, instances }
        } catch {
            return null
        }
    }, [])
    const { state, reload } = useConfigData(fetcher)

    return (
        <ConfigPage
            title="Docker snippets"
            subtitle="Saved docker run commands, built from a form. Attach a variables instance to inject its config at container boot. Maintainer access."
            icon="container"
            iconColor="cyan"
            state={state}
            onRetry={() => void reload()}
        >
            {(data) => <SnippetsTable data={data} onChanged={() => void reload()} />}
        </ConfigPage>
    )
}

/** Agent-server base URL for command rendering — the owner-configured
 *  "Instance config URL" setting, else this origin on the default agent port
 *  (the same fallback the instance Settings usage guide uses). */
function useAgentUrl(): string {
    const branding = useBranding()
    const fallback =
        typeof window !== 'undefined'
            ? `${window.location.protocol}//${window.location.hostname}:4101`
            : 'https://config.example.com'
    return branding.instanceUrl || fallback
}

function SnippetsTable({ data, onChanged }: { data: SnippetsData; onChanged: () => void }) {
    const toast = useToast()
    const agentUrl = useAgentUrl()
    const [editor, setEditor] = useState<{ snippet: DockerSnippet | null } | null>(null)
    const [command, setCommand] = useState<DockerSnippet | null>(null)
    const [pending, setPending] = useState<{ id: string; name: string } | null>(null)
    const [busy, setBusy] = useState(false)

    const rows = useMemo<SnippetRow[]>(
        () =>
            data.snippets.map((s) => ({
                id: s.id,
                name: s.name,
                image: imageRef(s.spec) || '—',
                instanceName: s.instanceName,
                description: s.description,
                updatedAt: s.updatedAt,
            })),
        [data.snippets],
    )

    const onAction = useCallback(
        (action: string, dataset: DOMStringMap) => {
            const id = dataset.id
            if (!id) return
            const snippet = data.snippets.find((s) => s.id === id)
            if (!snippet) return
            if (action === 'command') setCommand(snippet)
            else if (action === 'edit') setEditor({ snippet })
            else if (action === 'delete') setPending({ id, name: dataset.name ?? '' })
        },
        [data.snippets],
    )

    const doDelete = useCallback(async () => {
        if (!pending || busy) return
        const { id, name } = pending
        setPending(null)
        setBusy(true)
        const res = await callApi(`/api/snippets/${encodeURIComponent(id)}`, 'DELETE')
        setBusy(false)
        if (!res.ok) {
            toast.show(`Couldn’t delete “${name}”: ${res.message}`, { variant: 'error' })
            return
        }
        toast.show(`Deleted “${name}”.`, { variant: 'success' })
        onChanged()
    }, [pending, busy, onChanged, toast])

    return (
        <>
            <tc-section-card title="Snippets" icon="container">
                <div className="quaykeeper-admin-section">
                    <p className="quaykeeper-home-lead quaykeeper-admin-hint">
                        {data.snippets.length} snippet{data.snippets.length === 1 ? '' : 's'}. Each is a reusable{' '}
                        <code>docker run</code> command — click a name to copy it. Attaching a variables instance
                        rewrites the entrypoint so the container fetches its config via the quaykeeper-client at boot.
                    </p>

                    <div className="quaykeeper-instance-toolbar">
                        <tc-button variant="primary" size="sm" onClick={() => setEditor({ snippet: null })}>
                            New snippet
                        </tc-button>
                    </div>

                    {rows.length === 0 ? (
                        <tc-empty-state icon="container">No snippets yet.</tc-empty-state>
                    ) : (
                        <DataTable<SnippetRow> columns={SNIPPET_COLUMNS} rows={rows} rowKey={(row) => row.id} onAction={onAction} />
                    )}
                </div>
            </tc-section-card>

            {editor && (
                <SnippetEditor
                    key={editor.snippet?.id ?? 'new'}
                    snippet={editor.snippet}
                    instances={data.instances}
                    agentUrl={agentUrl}
                    onClose={() => setEditor(null)}
                    onSaved={() => {
                        setEditor(null)
                        onChanged()
                    }}
                />
            )}

            {command && (
                <CommandModal key={command.id} snippet={command} agentUrl={agentUrl} onClose={() => setCommand(null)} />
            )}

            <ConfirmDialog
                open={!!pending}
                title="Delete snippet?"
                message={pending ? `Delete “${pending.name}”. This cannot be undone.` : undefined}
                confirmLabel="Delete"
                danger
                onConfirm={() => void doDelete()}
                onCancel={() => setPending(null)}
            />
        </>
    )
}

// The read-only command modal. Same tc-modal relocation rules as FormModal:
// mounted fresh per snippet (keyed by the parent), exactly two stable direct
// children (body + footer), every close path lands in `onClose` via tc-hidden.
function CommandModal({
    snippet,
    agentUrl,
    onClose,
}: {
    snippet: DockerSnippet
    agentUrl: string
    onClose: () => void
}) {
    const ref = useTc<HTMLElement>(undefined, { 'tc-hidden': () => onClose() })
    const cmd = buildDockerRun(snippet.spec, { instanceName: snippet.instanceName, agentUrl })
    const injecting = snippet.spec.inject != null

    return (
        <tc-modal ref={ref} open title={snippet.name} size="lg" scrollable centered>
            <div className="quaykeeper-snippet-command">
                {injecting && snippet.instanceHasKey === false && (
                    <tc-banner variant="warning">
                        “{snippet.instanceName}” has no fetch key minted — the boot-time fetch will fail until one is
                        minted in the instance’s Settings tab.
                    </tc-banner>
                )}
                {injecting && !snippet.instanceName && (
                    <tc-banner variant="warning">
                        This snippet’s variables instance was deleted — re-attach one in the editor, or the fetch will
                        fail at boot.
                    </tc-banner>
                )}
                {injecting && (
                    <>
                        <p className="quaykeeper-admin-hint">
                            Export the instance’s fetch secret first — the command reads it from your shell and it is
                            never stored in the snippet:
                        </p>
                        <tc-code-snippet
                            code={`export QUAYKEEPER_SECRET='<the fetch secret minted on the instance>'`}
                            language="bash"
                            title="Prerequisite"
                            show-copy-button=""
                        />
                    </>
                )}
                <tc-code-snippet code={cmd} language="bash" title="docker run" show-copy-button="" />
                {injecting && (
                    <p className="quaykeeper-admin-hint">
                        At boot the container fetches the bootstrap (<code>{agentUrl}/v1/install.sh</code>), which
                        downloads the matching <code>quaykeeper-client</code> binary, pulls the instance’s resolved
                        variables, and execs your command. If the fetch fails the container exits instead of starting
                        half-configured.
                    </p>
                )}
            </div>
            <div slot="footer" className="quaykeeper-form-footer">
                <tc-button variant="secondary" outline onClick={onClose}>
                    Close
                </tc-button>
            </div>
        </tc-modal>
    )
}
