import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { fetchBranding, login, NEUTRAL_BRANDING, type Branding } from '../api/session'
import { AuthLayout } from '../components/AuthLayout'
import { BrandFooter } from '../components/BrandFooter'
import { BrandMark } from '../components/BrandMark'
import { t, type MessageKey } from '../i18n'
import { applyAppearance, applyTitle } from '../theme/branding'
import { domainOf } from '../util/safe'
import { readStore, writeStore } from '../util/storage'

const brandingCache = new Map<string, Branding>()

type Props = { notice?: MessageKey; onSignedIn: () => Promise<void> | void }

export function LoginScreen({ notice, onSignedIn }: Props) {
    const [email, setEmail] = useState<string>(() => readStore('lastAddress', ''))
    const [password, setPassword] = useState('')
    const [remember, setRemember] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [branding, setBranding] = useState<Branding>(NEUTRAL_BRANDING)
    const passwordRef = useRef<HTMLElement>(null)
    const domain = domainOf(email)

    // Restyle live from the domain part, debounced 400 ms. Unknown domains get
    // the neutral skin (the endpoint never errors for them).
    useEffect(() => {
        if (!domain) {
            setBranding(NEUTRAL_BRANDING)
            return
        }
        const cached = brandingCache.get(domain)
        if (cached) {
            setBranding(cached)
            return
        }
        const ctrl = new AbortController()
        const timer = window.setTimeout(() => {
            fetchBranding(domain, ctrl.signal)
                .then((b) => {
                    brandingCache.set(domain, b)
                    setBranding(b)
                })
                .catch(() => {
                    // keep the current skin; branding is cosmetic
                })
        }, 400)
        return () => {
            window.clearTimeout(timer)
            ctrl.abort()
        }
    }, [domain])

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
            if (ae.code === 'invalid_credentials' || ae.status === 401) setError(t('login.invalid'))
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
        <AuthLayout
            logo={<BrandMark branding={branding} size="lg" />}
            title={branding.loginTitle || t('login.title')}
        >
            {notice ? <tc-notice tone="info" text={t(notice)} live></tc-notice> : null}
            <form className="wm-login__form" onSubmit={submit} noValidate>
                <tc-form-input
                    type="email"
                    name="email"
                    label={t('login.email')}
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
