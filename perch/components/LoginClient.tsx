'use client'

import { useMemo, useState } from 'react'
import { useTc } from '@/lib/tc'

// Human-readable copy for the `?error=` codes the OAuth callback can redirect
// back with (§7). Anything unmapped falls back to a generic message.
const ERRORS: Record<string, string> = {
    state: 'Sign-in expired or was tampered with. Please try again.',
    not_allowed: 'Your GitHub account is not allowed to access Perch.',
    oauth: 'GitHub sign-in failed. Please try again.',
}

// tc-login renders its connect options from a JS property (object data the
// element can only receive as a DOM *property*, never a stringified attribute —
// hence useTc). Lucide ships no GitHub brand glyph, so we use `git-branch`,
// matching TaskForge.
const CONNECT = [{ key: 'github', label: 'Sign in with GitHub', icon: 'git-branch', variant: 'primary' as const }]

export function LoginClient({ error }: { error?: string }) {
    const message = error ? (ERRORS[error] ?? 'Sign-in failed. Please try again.') : null
    // Clicking connect kicks off a full-page redirect to GitHub; flip to a
    // "redirecting…" state so the click has immediate, visible feedback while the
    // browser navigates away.
    const [connecting, setConnecting] = useState(false)

    // Object prop (`connect`) + CustomEvent (`tc-connect`) both flow through the
    // useTc bridge. Clicking a connect button kicks off the GitHub OAuth code
    // flow at GET /api/auth/github, which redirects to GitHub.
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
        <div className="perch-login">
            {message && !connecting && (
                <tc-banner variant="error" role="alert">
                    {message}
                </tc-banner>
            )}
            {connecting ? (
                <div className="perch-login-redirect" role="status" aria-busy="true">
                    <tc-spinner type="border" />
                    <span>Redirecting to GitHub…</span>
                </div>
            ) : (
                <div className="perch-login-body">
                    <tc-login
                        ref={ref}
                        title="Perch"
                        description="Deploy a branch of your GitHub repository as a static website."
                    >
                        <tc-brand slot="logo" primary-text="Perch" color="#0ea5e9" />
                    </tc-login>
                </div>
            )}
        </div>
    )
}
