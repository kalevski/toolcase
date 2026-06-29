'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch, describeApiError } from '@/lib/fetcher'
import { useTc } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'
import type { Instance } from '@/server/domain/types'

interface Detail {
    instance: Instance
    environmentId: string
    environmentName: string
    effectiveRole: 'developer' | 'devops' | 'owner'
    isOwner: boolean
}

export function InstanceDetailClient({ projectId, instanceId }: { projectId: string; instanceId: string }) {
    const router = useRouter()
    const branding = useBranding()
    const [detail, setDetail] = useState<Detail | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [secret, setSecret] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [confirmRevoke, setConfirmRevoke] = useState(false)

    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                setDetail(await apiFetch<Detail>(`/api/projects/${projectId}/instances/${instanceId}`, { signal }))
            } catch (e) {
                if (!signal?.aborted) setErr(describeApiError(e))
            }
        },
        [projectId, instanceId],
    )

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    const mint = async () => {
        setBusy(true)
        setErr(null)
        try {
            const { secret } = await apiFetch<{ secret: string }>(
                `/api/projects/${projectId}/instances/${instanceId}/key`,
                { method: 'POST', body: JSON.stringify({}) },
            )
            setSecret(secret)
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    const revoke = async () => {
        setBusy(true)
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/instances/${instanceId}/key`, { method: 'DELETE' })
            setSecret(null)
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    const confirmRef = useTc<HTMLElement>(
        useMemo(() => ({ open: confirmRevoke }), [confirmRevoke]),
        {
            'tc-confirm': () => {
                setConfirmRevoke(false)
                void revoke()
            },
            'tc-cancel': () => setConfirmRevoke(false),
        },
    )

    if (err && !detail) return <tc-banner variant="error">{err}</tc-banner>
    if (!detail) {
        return (
            <div className="wharf-status-line" role="status" aria-busy="true">
                <tc-spinner type="border" size="sm" /> Loading…
            </div>
        )
    }

    const canManage = detail.effectiveRole !== 'developer'
    const secretShown = secret ?? '••••••••  (set from your Docker/orchestrator secret store)'
    const snippet = `WHARF_URL=${branding.agentUrl}
WHARF_ENVIRONMENT=${detail.environmentName}
WHARF_INSTANCE_ID=${detail.instance.id}
WHARF_SECRET=${secret ?? '<your-instance-secret>'}`

    const entrypoint = `ENTRYPOINT ["sh", "-c", "wget -qO- \\"$WHARF_URL/install.sh\\" | sh -s -- exec -- \\"$@\\"", "sh"]
CMD ["./my-app"]`

    const lastFetchLabel = detail.instance.lastFetchAt
        ? `Last fetch ${new Date(detail.instance.lastFetchAt).toLocaleString()}`
        : 'Never fetched'

    return (
        <div className="wharf-page">
            <button
                className="wharf-notfound-link"
                style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0, alignSelf: 'flex-start' }}
                onClick={() => router.push(`/projects/${projectId}`)}
            >
                ← Project
            </button>

            <tc-rich-page-header
                icon-name="Server"
                icon-color="emerald"
                title-text={detail.instance.name}
                sub={`Environment ${detail.environmentName}`}
                description={lastFetchLabel}
            >
                {detail.instance.hasKey ? (
                    <tc-badge slot="chips" variant="success">
                        key set
                    </tc-badge>
                ) : (
                    <tc-badge slot="chips" variant="secondary">
                        no key
                    </tc-badge>
                )}
            </tc-rich-page-header>

            {err && <tc-banner variant="error">{err}</tc-banner>}

            {secret && (
                <tc-banner variant="warning">
                    Copy this secret now — it is shown only once and stored only as a hash.
                </tc-banner>
            )}

            {canManage && (
                <tc-section-card title="Fetch key" icon="KeyRound">
                    <div className="wharf-section-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <tc-status-dot
                            status={detail.instance.hasKey ? 'online' : 'offline'}
                            label={detail.instance.hasKey ? 'Key active' : 'No key set'}
                        />
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <tc-button variant="primary" onClick={mint} disabled={busy}>
                                {detail.instance.hasKey ? 'Rotate key' : 'Mint key'}
                            </tc-button>
                            {detail.instance.hasKey && (
                                <tc-button
                                    variant="danger"
                                    outline
                                    onClick={() => setConfirmRevoke(true)}
                                    disabled={busy}
                                >
                                    Revoke key
                                </tc-button>
                            )}
                        </div>
                        {detail.instance.hasKey && (
                            <p style={{ margin: 0, color: 'var(--tc-text-muted)', fontSize: '0.8125rem' }}>
                                Rotating invalidates the old key immediately — the running container 401s until its
                                secret is updated <em>and</em> it restarts.
                            </p>
                        )}
                    </div>
                </tc-section-card>
            )}

            <tc-section-card title="wharf-client configuration" icon="Container">
                <div className="wharf-section-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <p style={{ margin: 0, color: 'var(--tc-text-muted)', fontSize: '0.875rem' }}>
                        Set these env vars on the target container. <code className="wharf-mono">WHARF_SECRET</code>{' '}
                        should come from a Docker/orchestrator secret — never baked into the image.
                    </p>
                    <tc-code-snippet language="bash" title="wharf-client env" code={snippet} />
                    <p style={{ margin: '0.25rem 0 0', color: 'var(--tc-text-muted)', fontSize: '0.875rem' }}>
                        Boot the client at runtime by adding this entrypoint (no {branding.appName} code baked into your image):
                    </p>
                    <tc-code-snippet language="bash" title="entrypoint" code={entrypoint} />
                    <p style={{ margin: 0, color: 'var(--tc-text-faint)', fontSize: '0.75rem' }}>
                        secret shown: {secretShown}
                    </p>
                </div>
            </tc-section-card>

            <tc-confirm-dialog
                ref={confirmRef}
                dialog-title="Revoke fetch key?"
                eyebrow="Destructive"
                message="The current key is invalidated immediately — the running container will 401 until a new key is minted and it restarts."
                confirm-label="Revoke key"
                cancel-label="Keep key"
                danger
            />
        </div>
    )
}
