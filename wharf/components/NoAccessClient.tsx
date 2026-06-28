'use client'

import { useRouter } from 'next/navigation'

export function NoAccessClient({ login }: { login: string }) {
    const router = useRouter()
    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
    }
    return (
        <div
            style={{
                minHeight: '100dvh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem',
            }}
        >
            <tc-empty-state icon="Lock">
                <h2>No access yet</h2>
                <p>
                    Signed in as <strong>@{login}</strong>. Your account isn’t a member of any project — ask an
                    owner to grant you access.
                </p>
                <tc-button variant="secondary" outline onClick={logout}>
                    Sign out
                </tc-button>
            </tc-empty-state>
        </div>
    )
}
