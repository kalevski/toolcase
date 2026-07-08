'use client'

import { useMemo, useState } from 'react'
import { useTc } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'

// Human-readable copy for the `?error=` codes the OAuth callback can redirect
// back with. Anything unmapped falls back to a generic message.
const ERRORS: Record<string, string> = {
    state: 'Sign-in expired or was tampered with. Please try again.',
    not_allowed: 'Your GitHub account is not allowed to access voxscribe.',
    oauth: 'GitHub sign-in failed. Please try again.',
}

// Lucide ships no GitHub brand glyph, so we use `git-branch` (blueprint style).
const CONNECT = [{ key: 'github', label: 'Sign in with GitHub', icon: 'git-branch', variant: 'primary' as const }]

export function LoginClient({ error }: { error?: string }) {
    const branding = useBranding()
    const message = error ? (ERRORS[error] ?? 'Sign-in failed. Please try again.') : null
    const [connecting, setConnecting] = useState(false)

    const ref = useTc<HTMLElement>(
        useMemo(() => ({ connect: CONNECT }), []),
        {
            'tc-connect': () => {
                setConnecting(true)
                window.location.href = '/api/auth/github'
            },
        },
    )

    return (
        <div className="voxscribe-login">
            {message && !connecting && (
                <tc-banner variant="error" role="alert">
                    {message}
                </tc-banner>
            )}
            {connecting ? (
                <div className="voxscribe-login-redirect" role="status" aria-busy="true">
                    <tc-spinner type="border" />
                    <span>Redirecting to GitHub…</span>
                </div>
            ) : (
                <div className="voxscribe-login-body">
                    <tc-login ref={ref} title={branding.appName} description={branding.tagline}>
                        <tc-brand
                            slot="logo"
                            primary-text={branding.appName}
                            secondary-text={branding.secondaryText || undefined}
                            color={branding.brandColor || undefined}
                        />
                    </tc-login>
                </div>
            )}
        </div>
    )
}
