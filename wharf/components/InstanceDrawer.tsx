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

/**
 * W3 — row→drawer for an instance. Opened from the project overview's instance
 * list, it shows the same key/config surface as the full instance page while
 * keeping the environment list in view. The full page
 * (/projects/[id]/instances/[instanceId]) stays as a deep-link fallback.
 *
 * tc-drawer captures its slotted body once on connect and re-appends it on a
 * structural re-render, which fights React reconciliation — so the parent keys
 * this component by the open instance id (fresh mount per instance) and we keep
 * the drawer `title` constant. Only `open` toggles within one instance's life,
 * and toggling `open` does NOT re-append the body (DialogBase only re-renders on
 * structural attribute changes).
 */
export function InstanceDrawer({
    projectId,
    instanceId,
    onClose,
    onChanged,
}: {
    projectId: string
    instanceId: string
    onClose: () => void
    onChanged: () => void
}) {
    const router = useRouter()
    const branding = useBranding()
    const [detail, setDetail] = useState<Detail | null>(null)
    const [err, setErr] = useState<string | null>(null)
    const [secret, setSecret] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)

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
            const res = await apiFetch<{ secret: string }>(
                `/api/projects/${projectId}/instances/${instanceId}/key`,
                { method: 'POST', body: JSON.stringify({}) },
            )
            setSecret(res.secret)
            await load()
            onChanged()
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
            onChanged()
        } catch (e) {
            setErr(describeApiError(e))
        } finally {
            setBusy(false)
        }
    }

    // Drawer reports tc-close (backdrop / Escape / close button) → bubble up.
    const drawerRef = useTc<HTMLElement>(
        useMemo(() => ({ open: true }), []),
        { 'tc-close': () => onClose() },
    )

    const canManage = detail ? detail.effectiveRole !== 'developer' : false
    const snippet = detail
        ? `WHARF_URL=${branding.agentUrl}
WHARF_ENVIRONMENT=${detail.environmentName}
WHARF_INSTANCE_ID=${detail.instance.id}
WHARF_SECRET=${secret ?? '<your-instance-secret>'}`
        : ''

    return (
        <tc-drawer ref={drawerRef} side="right" size="large" title="Instance">
            <div className="wharf-drawer-body">
                {err && <tc-banner variant="error">{err}</tc-banner>}

                {!detail ? (
                    <div className="wharf-status-line" role="status" aria-busy="true">
                        <tc-spinner type="border" size="sm" /> Loading…
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                            <div>
                                <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.125rem' }}>{detail.instance.name}</h2>
                                <span style={{ color: 'var(--tc-text-muted)', fontSize: '0.875rem' }}>
                                    Environment {detail.environmentName}
                                </span>
                            </div>
                            <tc-badge variant={detail.instance.hasKey ? 'success' : 'secondary'}>
                                {detail.instance.hasKey ? 'key set' : 'no key'}
                            </tc-badge>
                        </div>

                        <tc-divider />

                        <tc-status-dot
                            status={detail.instance.hasKey ? 'online' : 'offline'}
                            label={detail.instance.hasKey ? 'Key active' : 'No key set'}
                        />
                        <p style={{ margin: 0, color: 'var(--tc-text-muted)', fontSize: '0.8125rem' }}>
                            {detail.instance.lastFetchAt
                                ? `Last fetch ${new Date(detail.instance.lastFetchAt).toLocaleString()}`
                                : 'Never fetched'}
                        </p>

                        {secret && (
                            <tc-banner variant="warning">
                                Copy this secret now — it is shown only once and stored only as a hash.
                            </tc-banner>
                        )}

                        {canManage && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <tc-button variant="primary" size="sm" onClick={mint} disabled={busy}>
                                    {detail.instance.hasKey ? 'Rotate key' : 'Mint key'}
                                </tc-button>
                                {detail.instance.hasKey && (
                                    <tc-button variant="danger" outline size="sm" onClick={revoke} disabled={busy}>
                                        Revoke key
                                    </tc-button>
                                )}
                            </div>
                        )}

                        <tc-eyebrow>wharf-client config</tc-eyebrow>
                        <tc-code-snippet language="bash" title="wharf-client env" code={snippet} />

                        <tc-divider />
                        <tc-button
                            variant="secondary"
                            outline
                            size="sm"
                            onClick={() => router.push(`/projects/${projectId}/instances/${instanceId}`)}
                        >
                            Open full page →
                        </tc-button>
                    </>
                )}
            </div>
        </tc-drawer>
    )
}
