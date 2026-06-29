'use client'

import { useMemo } from 'react'
import { useTc } from '@/lib/tc'
import type { EnvVar } from '@/server/domain/types'

/**
 * W3 — row→drawer inspect for an env var. Opened from the variables table, it
 * shows the row's full metadata (source, value / secret reference, description,
 * required, timestamps) while the authoring table stays in view. Read-only —
 * editing stays inline in the table so this never competes with that flow.
 *
 * The parent keys this by the open var id so tc-drawer re-captures a fresh body
 * per var (the drawer relocates its slotted body on connect); the `title` stays
 * constant and only `open` toggles within one var's life.
 */
export function EnvVarDrawer({ row, onClose }: { row: EnvVar; onClose: () => void }) {
    const drawerRef = useTc<HTMLElement>(
        useMemo(() => ({ open: true }), []),
        { 'tc-close': () => onClose() },
    )

    const isSecret = row.source === 'secret_ref'

    return (
        <tc-drawer ref={drawerRef} side="right" size="default" title="Variable">
            <div className="wharf-drawer-body">
                <h2 style={{ margin: 0, fontSize: '1.0625rem' }}>
                    <code style={{ fontWeight: 600 }}>{row.key}</code>
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <tc-badge variant={isSecret ? 'secondary' : 'info'}>
                        {isSecret ? 'secret reference' : 'literal'}
                    </tc-badge>
                    {row.required && <tc-badge variant="warning">required</tc-badge>}
                </div>

                <tc-divider />

                <dl className="wharf-drawer-dl">
                    <dt>Value</dt>
                    <dd>
                        {isSecret ? (
                            <span style={{ color: 'var(--tc-text-muted)' }}>
                                secret <code>{row.secretKey ?? '—'}</code> — value resolves at fetch time
                            </span>
                        ) : (
                            <code style={{ wordBreak: 'break-all' }}>{row.value ?? ''}</code>
                        )}
                    </dd>

                    <dt>Description</dt>
                    <dd>{row.description ?? <span style={{ color: 'var(--tc-text-faint)' }}>—</span>}</dd>

                    <dt>Scope</dt>
                    <dd>{row.instanceId ? 'instance override' : 'environment baseline'}</dd>

                    <dt>Created</dt>
                    <dd>{row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}</dd>

                    <dt>Updated</dt>
                    <dd>{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}</dd>
                </dl>
            </div>
        </tc-drawer>
    )
}
