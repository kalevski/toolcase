'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/fetcher'
import { tcIcon } from '@/lib/icons'

export function NoAccessClient({ login }: { login: string }) {
    const router = useRouter()
    const logout = async () => {
        // Best-effort — land on /login even if the logout call fails.
        await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
        router.push('/login')
    }
    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
            }}
        >
            <tc-empty-state icon={tcIcon('lock')}>
                <h2>No permissions yet</h2>
                <p>
                    Signed in as <strong>@{login}</strong>. Your account has no access — ask the owner to grant
                    you a role.
                </p>
                <tc-button variant="secondary" outline onClick={logout}>
                    Logout
                </tc-button>
            </tc-empty-state>
        </div>
    )
}
