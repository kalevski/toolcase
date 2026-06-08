'use client'

import React, { useEffect } from 'react'
import { Login, Icon, toast } from '@toolcase/react-components'

const ERRORS: Record<string, string> = {
    state: 'Sign-in expired or was tampered with. Please try again.',
    not_allowed: 'Your GitHub account is not allowed to access this instance.',
    oauth: 'GitHub sign-in failed. Please try again.',
}

export function LoginClient({ error }: { error?: string }) {
    useEffect(() => {
        if (error) toast.error(ERRORS[error] ?? 'Sign-in failed.')
    }, [error])

    return (
        <div style={{ minHeight: '100vh', display: 'flex' }}>
            <Login
                title="TaskForge"
                description="Drive the Claude Code CLI over your local repositories."
                connect={[
                    {
                        id: 'github',
                        label: 'Sign in with GitHub',
                        color: '#24292f',
                        icon: <Icon name="github" />,
                    },
                ]}
                onConnect={() => {
                    window.location.href = '/api/auth/github'
                }}
            />
        </div>
    )
}
