import { useCallback, useEffect, useState } from 'react'
import { setCsrf, setUnauthorizedHandler } from './api/client'
import { fetchSession, NEUTRAL_BRANDING, type SessionInfo } from './api/session'
import { applyAppearance, applyTitle } from './theme/branding'
import { pickLocale, setLocale, t, type MessageKey } from './i18n'
import { LoginScreen } from './screens/LoginScreen'
import { InviteScreen } from './screens/InviteScreen'
import { MailApp } from './screens/MailApp'
import { ToastProvider } from './state/toasts'

type Route =
    | { kind: 'loading' }
    | { kind: 'error' }
    | { kind: 'login'; notice?: MessageKey }
    | { kind: 'invite'; token: string }
    | { kind: 'app'; session: SessionInfo }

function inviteToken(): string | null {
    const m = /^#\/invite\/([^/?#]+)/.exec(window.location.hash)
    return m ? decodeURIComponent(m[1]) : null
}

export function App() {
    const [route, setRoute] = useState<Route>(() => {
        const token = inviteToken()
        return token ? { kind: 'invite', token } : { kind: 'loading' }
    })

    const loadSession = useCallback(async (notice?: MessageKey) => {
        try {
            const s = await fetchSession()
            if (!s) {
                setCsrf('')
                setRoute({ kind: 'login', notice })
                return
            }
            setCsrf(s.csrf)
            setLocale(pickLocale(s.prefs.language, s.branding.defaultLanguage))
            setRoute({ kind: 'app', session: s })
        } catch {
            setRoute({ kind: 'error' })
        }
    }, [])

    useEffect(() => {
        if (route.kind === 'loading') void loadSession()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setUnauthorizedHandler(() => {
            setCsrf('')
            setRoute((r) => (r.kind === 'app' ? { kind: 'login', notice: 'login.signedOut' } : r))
        })
        const onHash = () => {
            const token = inviteToken()
            if (token) setRoute({ kind: 'invite', token })
        }
        window.addEventListener('hashchange', onHash)
        return () => {
            setUnauthorizedHandler(null)
            window.removeEventListener('hashchange', onHash)
        }
    }, [])

    useEffect(() => {
        if (route.kind === 'loading' || route.kind === 'error') {
            applyAppearance(NEUTRAL_BRANDING, 'system')
            applyTitle(NEUTRAL_BRANDING)
        }
    }, [route.kind])

    const toLogin = useCallback((notice?: MessageKey) => {
        if (window.location.hash) history.replaceState(null, '', window.location.pathname)
        setCsrf('')
        setRoute({ kind: 'login', notice })
    }, [])

    let screen
    switch (route.kind) {
        case 'loading':
            screen = (
                <div className="wm-center">
                    <tc-spinner label={t('common.loading')}></tc-spinner>
                </div>
            )
            break
        case 'error':
            screen = (
                <div className="wm-center wm-stack">
                    <p>{t('common.networkError')}</p>
                    <tc-button variant="primary" onClick={() => void loadSession()}>
                        {t('common.retry')}
                    </tc-button>
                </div>
            )
            break
        case 'login':
            screen = <LoginScreen notice={route.notice} onSignedIn={() => loadSession()} />
            break
        case 'invite':
            screen = <InviteScreen token={route.token} onDone={() => toLogin('invite.done')} />
            break
        case 'app':
            screen = <MailApp key={route.session.sessionId} session={route.session} onSignedOut={toLogin} />
            break
    }
    return <ToastProvider>{screen}</ToastProvider>
}
