'use client'

import { useRouter } from 'next/navigation'

export function NoAccessClient({ login }: { login: string }) {
    const router = useRouter()
    const signOut = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/login')
    }
    return (
        <div className="voxscribe-noaccess">
            <tc-banner variant="warning">
                <strong>@{login}</strong> is signed in but has no access yet. Ask an administrator to grant you
                the <code>standard</code> role.
            </tc-banner>
            <tc-button variant="secondary" outline onClick={signOut}>
                Sign out
            </tc-button>
        </div>
    )
}
