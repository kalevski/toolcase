import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { NEUTRAL_BRANDING, redeemInvite } from '../api/session'
import { AuthLayout } from '../components/AuthLayout'
import { BrandMark } from '../components/BrandMark'
import { t } from '../i18n'
import { applyAppearance, applyTitle } from '../theme/branding'

const MIN_LENGTH = 10

export function InviteScreen({ token, onDone }: { token: string; onDone: () => void }) {
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        applyAppearance(NEUTRAL_BRANDING, 'system')
        applyTitle(NEUTRAL_BRANDING)
    }, [])

    const submit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        if (password.length < MIN_LENGTH) return setError(t('invite.tooShort', { min: MIN_LENGTH }))
        if (password !== confirm) return setError(t('invite.mismatch'))
        setBusy(true)
        try {
            await redeemInvite(token, password)
            onDone()
        } catch (err) {
            const ae = err as ApiError
            if (ae.status === 400 && ae.message && ae.code !== 'invalid_token') setError(ae.message)
            else if (ae.status === 429) setError(t('login.rateLimitedNoTime'))
            else if (ae.status === 0) setError(t('common.networkError'))
            else setError(t('invite.invalid'))
        } finally {
            setBusy(false)
        }
    }

    return (
        <AuthLayout
            logo={<BrandMark branding={NEUTRAL_BRANDING} size="lg" />}
            title={t('invite.title')}
        >
            <p>{t('invite.intro')}</p>
            <form className="wm-login__form" onSubmit={submit} noValidate>
                <tc-form-input
                    type="password"
                    label={t('invite.password')}
                    autocomplete="new-password"
                    value={password}
                    required
                    help={t('invite.tooShort', { min: MIN_LENGTH })}
                    ontc-change={(e) => setPassword(String(e.detail.value ?? ''))}
                ></tc-form-input>
                <tc-form-input
                    type="password"
                    label={t('invite.confirm')}
                    autocomplete="new-password"
                    value={confirm}
                    required
                    ontc-change={(e) => setConfirm(String(e.detail.value ?? ''))}
                ></tc-form-input>
                {error ? (
                    <p className="wm-error" role="alert">
                        {error}
                    </p>
                ) : null}
                <tc-button type="submit" variant="primary" block loading={busy}>
                    {t('invite.submit')}
                </tc-button>
            </form>
        </AuthLayout>
    )
}
