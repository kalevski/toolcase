'use client'

import { useMemo, useState } from 'react'
import { useTc } from '@/lib/tc'
import { useBranding } from '@/lib/branding-context'

function errorMessage(code: string, appName: string): string {
    switch (code) {
        case 'state':
            return 'Sign-in expired or was tampered with. Please try again.'
        case 'not_allowed':
            return `Your GitHub account is not allowed to access ${appName}.`
        case 'oauth':
            return 'GitHub sign-in failed. Please try again.'
        default:
            return 'Sign-in failed. Please try again.'
    }
}

// Lucide ships no GitHub brand glyph, so we use `git-branch` (matches the other apps).
const CONNECT = [
    { key: 'github', label: 'Sign in with GitHub', icon: 'git-branch', variant: 'primary' as const },
]

export function LoginClient({ error }: { error?: string }) {
    const branding = useBranding()
    const message = error ? errorMessage(error, branding.appName) : null
    const [connecting, setConnecting] = useState(false)

    const ref = useTc<HTMLElement>(useMemo(() => ({ connect: CONNECT }), []), {
        'tc-connect': () => {
            setConnecting(true)
            window.location.href = '/api/auth/github'
        },
    })

    return (
        <div className="wharf-login">
            {message && !connecting && (
                <tc-banner variant="error" role="alert">
                    {message}
                </tc-banner>
            )}
            {connecting ? (
                <div className="wharf-login-redirect" role="status" aria-busy="true">
                    <tc-spinner type="border" />
                    <span>Redirecting to GitHub…</span>
                </div>
            ) : (
                <div className="wharf-login-body">
                    <tc-login ref={ref} title={branding.appName} description={branding.tagline}>
                        <tc-brand slot="logo" primary-text={branding.appName} color={branding.brandColor} />
                    </tc-login>
                </div>
            )}
        </div>
    )
}
