import React, { useEffect, useRef } from 'react'

// Minimal repeating dot SVG data URI for the background-pattern-src demo.
const DOT_PATTERN =
    "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Ccircle cx='20' cy='20' r='1.5' fill='white' fill-opacity='0.18'/%3E%3C/svg%3E"

const LoginDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const fullRef = useRef<any>(null)
    const loadingRef = useRef<any>(null)
    const noAsideRef = useRef<any>(null)

    useEffect(() => {
        if (basicRef.current) {
            basicRef.current.connect = [
                {
                    key: 'github',
                    label: 'Continue with GitHub',
                    icon: 'github',
                    variant: 'primary',
                },
                {
                    key: 'google',
                    label: 'Continue with Google',
                    icon: 'mail',
                    variant: 'secondary',
                },
            ]
            basicRef.current.addEventListener('tc-connect', (e: CustomEvent) => {
                console.log('tc-connect', e.detail.key)
            })
        }
    }, [])

    useEffect(() => {
        if (fullRef.current) {
            fullRef.current.connect = [
                {
                    key: 'github',
                    label: 'Continue with GitHub',
                    icon: 'github',
                    variant: 'primary',
                },
                {
                    key: 'google',
                    label: 'Continue with Google',
                    icon: 'mail',
                    variant: 'secondary',
                },
                { key: 'sso', label: 'Continue with SSO', icon: 'shield', variant: 'secondary' },
            ]
            fullRef.current.addEventListener('tc-connect', (e: CustomEvent) => {
                console.log('tc-connect', e.detail.key)
            })
        }
    }, [])

    useEffect(() => {
        if (loadingRef.current) {
            loadingRef.current.connect = [
                {
                    key: 'github',
                    label: 'Continue with GitHub',
                    icon: 'github',
                    variant: 'primary',
                },
                { key: 'google', label: 'Continue with Google', variant: 'secondary' },
            ]
        }
    }, [])

    useEffect(() => {
        if (noAsideRef.current) {
            noAsideRef.current.connect = [
                {
                    key: 'github',
                    label: 'Continue with GitHub',
                    icon: 'github',
                    variant: 'primary',
                },
                {
                    key: 'google',
                    label: 'Continue with Google',
                    icon: 'mail',
                    variant: 'secondary',
                },
                { key: 'apple', label: 'Continue with Apple', icon: 'apple', variant: 'secondary' },
            ]
            noAsideRef.current.addEventListener('tc-connect', (e: CustomEvent) => {
                console.log('tc-connect', e.detail.key)
            })
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Login"
                            description="Two-column login layout with a decorative ink aside (background pattern) and a form column containing a logo slot, title, description, and OAuth connect buttons."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Basic — title, description, and connect buttons">
                                {/* @ts-ignore */}
                                <tc-login
                                    ref={basicRef}
                                    title="Sign in"
                                    description="Welcome back. Choose a provider to continue."
                                    style={{ minHeight: '420px' }}
                                >
                                    <span
                                        slot="logo"
                                        style={{
                                            fontWeight: 700,
                                            fontSize: '1.125rem',
                                            color: '#1e293b',
                                            letterSpacing: '-0.02em',
                                        }}
                                    >
                                        toolcase
                                    </span>
                                </tc-login>
                            </tc-section-card>

                            <tc-section-card title="Full — with background-pattern-src, logo slot, and 3 providers">
                                {/* @ts-ignore */}
                                <tc-login
                                    ref={fullRef}
                                    title="Welcome back"
                                    description="Sign in to your account to continue."
                                    background-pattern-src={DOT_PATTERN}
                                    style={{ minHeight: '480px' }}
                                >
                                    <span
                                        slot="logo"
                                        style={{
                                            fontWeight: 800,
                                            fontSize: '1.25rem',
                                            color: '#1e293b',
                                            letterSpacing: '-0.03em',
                                        }}
                                    >
                                        toolcase
                                    </span>
                                </tc-login>
                            </tc-section-card>

                            <tc-section-card title="No aside — no background-pattern-src">
                                {/* @ts-ignore */}
                                <tc-login
                                    ref={noAsideRef}
                                    title="Create account"
                                    description="Select a provider to get started."
                                    style={{ minHeight: '420px' }}
                                />
                            </tc-section-card>

                            <tc-section-card title="Loading state">
                                {/* @ts-ignore */}
                                <tc-login
                                    ref={loadingRef}
                                    title="Sign in"
                                    loading
                                    style={{ minHeight: '400px' }}
                                >
                                    <span
                                        slot="logo"
                                        style={{
                                            fontWeight: 700,
                                            fontSize: '1.125rem',
                                            color: '#1e293b',
                                        }}
                                    >
                                        toolcase
                                    </span>
                                </tc-login>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoginDemo
