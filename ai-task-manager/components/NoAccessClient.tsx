'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState, Button } from '@toolcase/react-components'

export function NoAccessClient({ login }: { login: string }) {
    const router = useRouter()
    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
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
            <EmptyState icon="lock">
                <h2>No permissions yet</h2>
                <p>
                    Signed in as <strong>@{login}</strong>. Your account has no access — ask an admin to grant
                    you a role.
                </p>
                <Button variant="secondary" outline onClick={logout}>
                    Logout
                </Button>
            </EmptyState>
        </div>
    )
}
