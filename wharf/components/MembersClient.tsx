'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch, describeApiError, ApiError } from '@/lib/fetcher'
import { useTc, detailValue } from '@/lib/tc'
import type { AppUser, ProjectMemberRow, ProjectRole } from '@/server/domain/types'

export function MembersClient({ projectId }: { projectId: string }) {
    const [members, setMembers] = useState<ProjectMemberRow[] | null>(null)
    const [users, setUsers] = useState<AppUser[]>([])
    const [err, setErr] = useState<string | null>(null)
    const [pick, setPick] = useState('')
    const [role, setRole] = useState<ProjectRole>('developer')
    const [confirmRemove, setConfirmRemove] = useState<ProjectMemberRow | null>(null)
    const pickRef = useRef(pick)
    pickRef.current = pick
    const roleRef = useRef(role)
    roleRef.current = role

    const load = useCallback(
        async (signal?: AbortSignal) => {
            try {
                const [m, u] = await Promise.all([
                    apiFetch<ProjectMemberRow[]>(`/api/projects/${projectId}/members`, { signal }),
                    apiFetch<AppUser[]>('/api/users', { signal }),
                ])
                setMembers(m)
                setUsers(u)
            } catch (e) {
                if (!signal?.aborted) setErr(describeApiError(e))
            }
        },
        [projectId],
    )

    useEffect(() => {
        const ctrl = new AbortController()
        void load(ctrl.signal)
        return () => ctrl.abort()
    }, [load])

    const memberIds = useMemo(() => new Set((members ?? []).map((m) => m.member.githubId)), [members])
    const candidates = useMemo(() => users.filter((u) => !memberIds.has(u.githubId)), [users, memberIds])

    const add = async () => {
        const githubId = Number(pickRef.current)
        if (!githubId) return
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/members`, {
                method: 'POST',
                body: JSON.stringify({ githubId, role: roleRef.current }),
            })
            setPick('')
            await load()
        } catch (e) {
            setErr(e instanceof ApiError && e.status === 422 ? 'That user must sign in once before being added.' : describeApiError(e))
        }
    }

    const changeRole = async (githubId: number, next: ProjectRole) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/members/${githubId}`, {
                method: 'PATCH',
                body: JSON.stringify({ role: next }),
            })
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const remove = async (githubId: number) => {
        setErr(null)
        try {
            await apiFetch(`/api/projects/${projectId}/members/${githubId}`, { method: 'DELETE' })
            await load()
        } catch (e) {
            setErr(describeApiError(e))
        }
    }

    const userOptions = useMemo(
        () => candidates.map((u) => ({ value: String(u.githubId), label: `${u.name} (@${u.login})` })),
        [candidates],
    )
    const roleOptions = useMemo(
        () => [
            { value: 'developer', label: 'developer' },
            { value: 'devops', label: 'devops' },
        ],
        [],
    )

    const pickRef2 = useTc<HTMLElement>(
        useMemo(() => ({ items: userOptions.map((o) => ({ key: o.value, label: o.label })), value: pick }), [userOptions, pick]),
        { 'tc-change': (e: Event) => setPick(detailValue<string>(e) ?? '') },
    )
    const roleSelectRef = useTc<HTMLElement>(
        useMemo(() => ({ items: roleOptions.map((o) => ({ key: o.value, label: o.label })), value: role }), [roleOptions, role]),
        { 'tc-change': (e: Event) => setRole((detailValue<string>(e) as ProjectRole) ?? 'developer') },
    )

    const confirmRef = useTc<HTMLElement>(
        useMemo(() => ({ open: confirmRemove !== null }), [confirmRemove]),
        {
            'tc-confirm': () => {
                const target = confirmRemove
                setConfirmRemove(null)
                if (target) void remove(target.member.githubId)
            },
            'tc-cancel': () => setConfirmRemove(null),
        },
    )

    return (
        <div className="wharf-page">
            <tc-rich-page-header icon-name="Users" icon-color="cyan" title-text="Members" sub="Grant project access" />


            {err && <tc-banner variant="error">{err}</tc-banner>}

            <tc-section-card title="Add member" icon="UserPlus">
                <div className="wharf-section-body">
                    <p style={{ margin: '0 0 1rem', color: 'var(--tc-text-muted)' }}>
                        <strong>developer</strong> manages env vars, flags and notes; <strong>devops</strong> additionally
                        sees secrets, instance keys and the Docker builder.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <tc-extended-select ref={pickRef2} label="Add member" placeholder="Pick a user…" style={{ flex: '1 1 18rem' }} />
                        <tc-extended-select ref={roleSelectRef} label="Role" style={{ flex: '0 1 10rem' }} />
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                        <tc-button variant="primary" onClick={add} disabled={!pick}>
                            Add
                        </tc-button>
                    </div>
                </div>
            </tc-section-card>

            <tc-section-card title="Roster" icon="Users">
                <div className="wharf-section-body">
                    {members === null ? (
                        <div className="wharf-status-line" role="status" aria-busy="true">
                            <tc-spinner type="border" size="sm" /> Loading…
                        </div>
                    ) : members.length === 0 ? (
                        <tc-empty-state icon="Users">
                            <h2>No members</h2>
                            <p>Add a user above to grant project access.</p>
                        </tc-empty-state>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Member</th>
                                    <th>Project role</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((m) => (
                                    <tr key={m.member.githubId}>
                                        <td>
                                            <strong>{m.user.name}</strong>{' '}
                                            <span style={{ color: 'var(--tc-text-muted)' }}>@{m.user.login}</span>
                                        </td>
                                        <td>
                                            <tc-badge variant={m.member.projectRole === 'devops' ? 'primary' : 'secondary'}>
                                                {m.member.projectRole}
                                            </tc-badge>
                                        </td>
                                        <td style={{ textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                            <tc-button
                                                size="sm"
                                                variant="secondary"
                                                outline
                                                onClick={() =>
                                                    changeRole(
                                                        m.member.githubId,
                                                        m.member.projectRole === 'devops' ? 'developer' : 'devops',
                                                    )
                                                }
                                            >
                                                {m.member.projectRole === 'devops' ? 'Make developer' : 'Make devops'}
                                            </tc-button>
                                            <tc-button size="sm" variant="danger" outline onClick={() => setConfirmRemove(m)}>
                                                Remove
                                            </tc-button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </tc-section-card>

            <tc-confirm-dialog
                ref={confirmRef}
                eyebrow="Remove member"
                dialog-title="Remove this member?"
                message={
                    confirmRemove
                        ? `${confirmRemove.user.name} (@${confirmRemove.user.login}) will lose access to this project.`
                        : ''
                }
                confirm-label="Remove"
                cancel-label="Cancel"
                danger
            />
        </div>
    )
}
