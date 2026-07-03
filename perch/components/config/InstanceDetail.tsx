'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SubTabBar, type SubTab } from '@/components/SubTabBar'
import { LoadingState, ErrorState, EmptyState } from '@/components/states'
import { ApiError, apiFetch, describeApiError } from '@/lib/fetcher'
import type { Instance } from '@/server/domain/types'
import { InstanceVars } from './InstanceVars'
import { InstanceFlags } from './InstanceFlags'
import { InstanceSettings } from './InstanceSettings'

// Per-instance page (`/instances/{id}/{variables|flags|settings}`,
// move_wharf_to_perch.md §10). Header via tc-rich-page-header; a route-based
// SubTabBar (wharf-style sub-nav) switches between the three tabs.

export type InstanceTab = 'variables' | 'flags' | 'settings'

type LoadState =
    | { phase: 'loading' }
    | { phase: 'error'; notFound: boolean; message: string }
    | { phase: 'ready'; instance: Instance }

export function InstanceDetail({ instanceId, tab }: { instanceId: string; tab: InstanceTab }) {
    const router = useRouter()
    const [state, setState] = useState<LoadState>({ phase: 'loading' })

    const load = useCallback(
        async (signal?: AbortSignal) => {
            setState({ phase: 'loading' })
            try {
                const instance = await apiFetch<Instance>(`/api/instances/${encodeURIComponent(instanceId)}`, {
                    signal,
                })
                setState({ phase: 'ready', instance })
            } catch (err) {
                if (signal?.aborted) return
                const notFound = err instanceof ApiError && (err.kind === 'notfound' || err.kind === 'forbidden')
                setState({ phase: 'error', notFound, message: describeApiError(err) })
            }
        },
        [instanceId],
    )

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    const back = (
        <button type="button" className="perch-back" onClick={() => router.push('/instances')}>
            ← All instances
        </button>
    )

    if (state.phase === 'loading') {
        return (
            <section className="perch-instance">
                {back}
                <LoadingState shape="detail" label="Loading instance…" />
            </section>
        )
    }

    if (state.phase === 'error') {
        return (
            <section className="perch-instance">
                {back}
                {state.notFound ? (
                    <EmptyState
                        icon="search-x"
                        title="Instance not found"
                        description="It may have been deleted, or you don’t have access to it."
                    >
                        <tc-button variant="primary" size="sm" onClick={() => router.push('/instances')}>
                            Back to instances
                        </tc-button>
                    </EmptyState>
                ) : (
                    <ErrorState title="Couldn’t load this instance" message={state.message} onRetry={() => void load()} />
                )}
            </section>
        )
    }

    const { instance } = state
    const tabs: SubTab[] = [
        { id: 'variables', label: 'Variables', icon: 'variable', href: `/instances/${instanceId}/variables` },
        { id: 'flags', label: 'Flags', icon: 'flag', href: `/instances/${instanceId}/flags` },
        { id: 'settings', label: 'Settings', icon: 'settings', href: `/instances/${instanceId}/settings` },
    ]

    return (
        <section className="perch-instance">
            {back}
            <tc-rich-page-header
                title-text={instance.name}
                description={instance.description}
                icon-name="server"
                icon-color="cyan"
            />
            <SubTabBar tabs={tabs} />
            <div className="perch-instance-body">
                {tab === 'variables' && <InstanceVars instance={instance} />}
                {tab === 'flags' && <InstanceFlags instanceId={instance.id} />}
                {tab === 'settings' && (
                    <InstanceSettings
                        instance={instance}
                        onChanged={(next) => setState({ phase: 'ready', instance: next })}
                        onDeleted={() => router.push('/instances')}
                    />
                )}
            </div>
        </section>
    )
}
