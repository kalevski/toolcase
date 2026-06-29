'use client'

import React, { useEffect } from 'react'
import { toast } from '@/lib/toast'
import { useTc } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'

const ERRORS: Record<string, string> = {
    state: 'Sign-in expired or was tampered with. Please try again.',
    not_allowed: 'Your GitHub account is not allowed to access this instance.',
    oauth: 'GitHub sign-in failed. Please try again.',
}

// tc-login takes its connect options as a JS property (icons resolve via lucide
// kebab names — Lucide has no GitHub brand glyph, so we use git-branch).
const CONNECT = [{ key: 'github', label: 'Sign in with GitHub', icon: 'git-branch', variant: 'primary' as const }]

export function LoginClient({ error }: { error?: string }) {
    const branding = useBranding()
    useEffect(() => {
        if (error) toast.error(ERRORS[error] ?? 'Sign-in failed.')
    }, [error])

    const ref = useTc<HTMLElement>(
        { connect: CONNECT },
        {
            'tc-connect': () => {
                window.location.href = '/api/auth/github'
            },
        },
    )

    return (
        <div style={{ minHeight: '100vh', display: 'flex' }}>
            <tc-login
                ref={ref}
                title="TaskForge"
                description="Drive the Claude Code CLI over your local repositories."
            >
                <tc-brand
                    slot="logo"
                    primary-text="Task Forge"
                    secondary-text={branding.secondaryText || undefined}
                    color="#6c5ce7"
                />
            </tc-login>
        </div>
    )
}
