import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { fetchBranding, login, NEUTRAL_BRANDING, type Branding } from '../api/session'
import { AuthLayout } from '../components/AuthLayout'
import { BrandFooter } from '../components/BrandFooter'
import { t, type MessageKey } from '../i18n'
import { applyAppearance, applyTitle } from '../theme/branding'
import { readStore, writeStore } from '../util/storage'

type Props = { notice?: MessageKey; onSignedIn: () => Promise<void> | void }

export function LoginScreen({ notice, onSignedIn }: Props) {
    const [email, setEmail] = useState<string>(() => readStore('lastAddress', ''))
    const [password, setPassword] = useState('')
    const [remember, setRemember] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [branding, setBranding] = useState<Branding>(NEUTRAL_BRANDING)
    const passwordRef = useRef<HTMLElement>(null)
    const domainOnly = branding.known && branding.signInScope === 'domain'

    // The look belongs to the address the page is served on, so it is read once and never follows what is typed.
    useEffect(() => {
        const ctrl = new AbortController()
        fetchBranding(ctrl.signal)
            .then(setBranding)
            .catch(() => {
                // keep the neutral skin; branding is cosmetic
            })
        return () => ctrl.abort()
    }, [])

    useEffect(() => {
        applyAppearance(branding, 'system')
        applyTitle(branding)
    }, [branding])

    const submit = async (e: FormEvent) => {
        e.preventDefault()
        if (busy) return
        setError('')
        if (!email.trim() || !password) return
        setBusy(true)
        try {
            await login(email.trim(), password, remember)
            writeStore('lastAddress', email.trim())
            setPassword('')
            await onSignedIn()
        } catch (err) {
            const ae = err as ApiError
            if (ae.code === 'domain_not_allowed') setError(t('login.domainOnly', { domain: branding.domain }))
            else if (ae.code === 'invalid_credentials' || ae.status === 401) setError(t('login.invalid'))
            else if (ae.code === 'rate_limited' || ae.status === 429) {
                setError(
                    ae.retryAfter
                        ? t('login.rateLimited', { seconds: Math.ceil(ae.retryAfter) })
                        : t('login.rateLimitedNoTime'),
                )
            } else if (ae.status === 0) setError(t('common.networkError'))
            else setError(ae.message || t('common.error'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <AuthLayout branding={branding} title={branding.loginTitle || t('login.title')}>
            {notice ? <tc-notice tone="info" text={t(notice)} live></tc-notice> : null}
            <form className="wm-login__form" onSubmit={submit} noValidate>
                <tc-form-input
                    type="email"
                    name="email"
                    label={t('login.email')}
                    placeholder={domainOnly ? t('login.domainPlaceholder', { domain: branding.domain }) : undefined}
                    help={domainOnly && !error ? t('login.domainOnly', { domain: branding.domain }) : undefined}
                    autocomplete="username"
                    value={email}
                    required
                    ontc-change={(e) => setEmail(String(e.detail.value ?? ''))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !password) {
                            e.preventDefault()
                            passwordRef.current?.querySelector('input')?.focus()
                        }
                    }}
                ></tc-form-input>
                <tc-form-input
                    ref={passwordRef}
                    type="password"
                    name="password"
                    label={t('login.password')}
                    autocomplete="current-password"
                    value={password}
                    required
                    ontc-change={(e) => setPassword(String(e.detail.value ?? ''))}
                ></tc-form-input>
                <tc-check
                    label={t('login.remember')}
                    checked={remember}
                    ontc-change={(e) => setRemember(e.detail.value === true)}
                ></tc-check>
                {error ? (
                    <p className="wm-error" role="alert">
                        {error}
                    </p>
                ) : null}
                <tc-button type="submit" variant="primary" block loading={busy}>
                    {t('login.submit')}
                </tc-button>
            </form>
            {branding.loginMessage ? (
                <p className="wm-login__message">{branding.loginMessage}</p>
            ) : null}
            <BrandFooter branding={branding} />
        </AuthLayout>
    )
}
