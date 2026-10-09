import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useTc } from '@toolcase/web-components/react'
import { ApiError } from '../api/client'
import { getVacation, setVacation, updateIdentity } from '../api/mail'
import { changePassword, endSession, listSessions, type ActiveSession, type Prefs } from '../api/session'
import { CAP_VACATION, type VacationResponse } from '../jmap/types'
import { LANGUAGES, t, type MessageKey } from '../i18n'
import { useMail } from '../state/mail'
import { useToasts } from '../state/toasts'
import { formatLongDate } from '../util/format'

type Tab = 'general' | 'identity' | 'vacation' | 'security'

function General() {
    const { prefs, updatePrefs } = useMail()
    const set = <K extends keyof Prefs>(key: K, value: Prefs[K]) => void updatePrefs({ [key]: value } as Partial<Prefs>)
    return (
        <>
            <tc-section-card title={t('settings.card.general')} icon="Settings2">
                <div className="wm-settings__form">
                    <tc-select
                        label={t('settings.language')}
                        value={prefs.language ?? ''}
                        ontc-change={(e) => set('language', String(e.detail.value || '') || undefined)}
                    >
                        <tc-option value="">{t('settings.languageAuto')}</tc-option>
                        {LANGUAGES.map((l) => (
                            <tc-option key={l.code} value={l.code}>
                                {l.label}
                            </tc-option>
                        ))}
                    </tc-select>
                    <div className="wm-grid-2">
                        <tc-select
                            label={t('settings.theme')}
                            value={prefs.theme}
                            ontc-change={(e) => set('theme', e.detail.value as Prefs['theme'])}
                        >
                            <tc-option value="system">{t('settings.themeSystem')}</tc-option>
                            <tc-option value="light">{t('settings.themeLight')}</tc-option>
                            <tc-option value="dark">{t('settings.themeDark')}</tc-option>
                        </tc-select>
                        <tc-select
                            label={t('settings.density')}
                            value={prefs.density}
                            ontc-change={(e) => set('density', e.detail.value as Prefs['density'])}
                        >
                            <tc-option value="comfortable">{t('settings.densityComfortable')}</tc-option>
                            <tc-option value="compact">{t('settings.densityCompact')}</tc-option>
                        </tc-select>
                    </div>
                    <tc-select
                        label={t('settings.layout')}
                        help={t('settings.layoutHelp')}
                        value={prefs.layout}
                        ontc-change={(e) => set('layout', e.detail.value as Prefs['layout'])}
                    >
                        <tc-option value="right">{t('settings.layoutRight')}</tc-option>
                        <tc-option value="bottom">{t('settings.layoutBottom')}</tc-option>
                        <tc-option value="list">{t('settings.layoutList')}</tc-option>
                    </tc-select>
                </div>
            </tc-section-card>
            <tc-section-card title={t('settings.card.images')} icon="Image">
                <div className="wm-settings__form">
                    <tc-select
                        label={t('settings.images')}
                        value={prefs.imagePolicy}
                        ontc-change={(e) => set('imagePolicy', e.detail.value as Prefs['imagePolicy'])}
                    >
                        <tc-option value="ask">{t('settings.imagesAsk')}</tc-option>
                        <tc-option value="always">{t('settings.imagesAlways')}</tc-option>
                        <tc-option value="never">{t('settings.imagesNever')}</tc-option>
                    </tc-select>
                    <h3 className="wm-settings__h">{t('settings.trusted')}</h3>
                    {prefs.trustedSenders.length ? (
                        <ul className="wm-plain-list">
                            {prefs.trustedSenders.map((s) => (
                                <li key={s} className="wm-plain-list__row wm-plain-list__row--mono">
                                    <span>{s}</span>
                                    <tc-icon-button
                                        icon="X"
                                        size="small"
                                        label={t('settings.removeTrusted', { address: s })}
                                        ontc-click={() =>
                                            set(
                                                'trustedSenders',
                                                prefs.trustedSenders.filter((x) => x !== s),
                                            )
                                        }
                                    ></tc-icon-button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="wm-settings__lead">{t('settings.trustedNone')}</p>
                    )}
                </div>
            </tc-section-card>
        </>
    )
}

function Identities() {
    const { jmap, identities, refreshIdentities } = useMail()
    const toasts = useToasts()
    const [drafts, setDrafts] = useState<Record<string, { name: string; textSignature: string }>>({})
    const [busy, setBusy] = useState('')

    useEffect(() => {
        setDrafts(
            Object.fromEntries(
                identities.map((i) => [i.id, { name: i.name, textSignature: i.textSignature ?? '' }]),
            ),
        )
    }, [identities])

    const save = async (id: string) => {
        const d = drafts[id]
        if (!d) return
        setBusy(id)
        try {
            await updateIdentity(jmap, id, { name: d.name, textSignature: d.textSignature })
            await refreshIdentities()
            toasts.show({ message: t('common.saved'), variant: 'success', duration: 2500 })
        } catch {
            toasts.show({ message: t('common.error'), variant: 'danger' })
        } finally {
            setBusy('')
        }
    }

    return (
        <>
            <p className="wm-settings__lead">{t('settings.identityHelp')}</p>
            {identities.map((i) => (
                <tc-section-card key={i.id} title={i.email} icon="AtSign">
                    <div className="wm-settings__form">
                        <tc-form-input
                            label={t('settings.displayName')}
                            value={drafts[i.id]?.name ?? ''}
                            ontc-change={(e) =>
                                setDrafts((d) => ({ ...d, [i.id]: { ...d[i.id], name: String(e.detail.value ?? '') } }))
                            }
                        ></tc-form-input>
                        <tc-form-input
                            type="textarea"
                            rows="4"
                            label={t('settings.signature')}
                            help={t('settings.signatureHelp')}
                            value={drafts[i.id]?.textSignature ?? ''}
                            ontc-change={(e) =>
                                setDrafts((d) => ({
                                    ...d,
                                    [i.id]: { ...d[i.id], textSignature: String(e.detail.value ?? '') },
                                }))
                            }
                        ></tc-form-input>
                        <tc-button variant="primary" size="sm" loading={busy === i.id} onClick={() => void save(i.id)}>
                            {t('common.save')}
                        </tc-button>
                    </div>
                </tc-section-card>
            ))}
        </>
    )
}

function toDateInput(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function Vacation() {
    const { jmap } = useMail()
    const toasts = useToasts()
    const [v, setV] = useState<VacationResponse | null | undefined>(undefined)
    const [busy, setBusy] = useState(false)
    const available = jmap.has(CAP_VACATION)

    useEffect(() => {
        if (!available) return
        getVacation(jmap)
            .then(setV)
            .catch(() => setV(null))
    }, [jmap, available])

    if (!available || v === null) {
        return (
            <tc-section-card title={t('settings.card.vacation')} icon="Plane">
                <p className="wm-settings__lead">{t('settings.vacationUnavailable')}</p>
            </tc-section-card>
        )
    }
    if (v === undefined) return <tc-spinner label={t('common.loading')}></tc-spinner>

    const save = async (e: FormEvent) => {
        e.preventDefault()
        setBusy(true)
        try {
            await setVacation(jmap, {
                isEnabled: v.isEnabled,
                subject: v.subject || null,
                textBody: v.textBody || null,
                fromDate: v.fromDate ? new Date(`${toDateInput(v.fromDate)}T00:00:00`).toISOString() : null,
                toDate: v.toDate ? new Date(`${toDateInput(v.toDate)}T23:59:59`).toISOString() : null,
            })
            toasts.show({ message: t('common.saved'), variant: 'success', duration: 2500 })
        } catch {
            toasts.show({ message: t('common.error'), variant: 'danger' })
        } finally {
            setBusy(false)
        }
    }

    const dateValue = (s: string) => (s ? new Date(`${s}T12:00:00`).toISOString() : null)

    return (
        <tc-section-card title={t('settings.card.vacation')} icon="Plane">
            <form className="wm-settings__form" onSubmit={save}>
                <tc-switch
                    label={t('settings.vacationEnabled')}
                    checked={v.isEnabled}
                    ontc-change={(e) => setV({ ...v, isEnabled: e.detail.value === true })}
                ></tc-switch>
                <tc-form-input
                    label={t('settings.vacationSubject')}
                    value={v.subject ?? ''}
                    ontc-change={(e) => setV({ ...v, subject: String(e.detail.value ?? '') })}
                ></tc-form-input>
                <tc-form-input
                    type="textarea"
                    rows="6"
                    label={t('settings.vacationBody')}
                    value={v.textBody ?? ''}
                    ontc-change={(e) => setV({ ...v, textBody: String(e.detail.value ?? '') })}
                ></tc-form-input>
                <div className="wm-grid-2">
                    <tc-form-input
                        type="date"
                        label={t('settings.vacationFrom')}
                        value={toDateInput(v.fromDate)}
                        ontc-change={(e) => setV({ ...v, fromDate: dateValue(String(e.detail.value ?? '')) })}
                    ></tc-form-input>
                    <tc-form-input
                        type="date"
                        label={t('settings.vacationTo')}
                        value={toDateInput(v.toDate)}
                        ontc-change={(e) => setV({ ...v, toDate: dateValue(String(e.detail.value ?? '')) })}
                    ></tc-form-input>
                </div>
                <tc-button type="submit" variant="primary" size="sm" loading={busy}>
                    {t('common.save')}
                </tc-button>
            </form>
        </tc-section-card>
    )
}

function Security({ onPasswordChanged }: { onPasswordChanged: () => void }) {
    const { session } = useMail()
    const toasts = useToasts()
    const [current, setCurrent] = useState('')
    const [next, setNext] = useState('')
    const [repeat, setRepeat] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [sessions, setSessions] = useState<ActiveSession[] | null>(null)

    const loadSessions = () =>
        listSessions()
            .then(setSessions)
            .catch(() => setSessions([]))

    useEffect(() => {
        void loadSessions()
    }, [])

    const submit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        if (next.length < 10) return setError(t('password.tooShort', { min: 10 }))
        if (next !== repeat) return setError(t('password.mismatch'))
        setBusy(true)
        try {
            await changePassword(current, next)
            onPasswordChanged()
        } catch (err) {
            const ae = err as ApiError
            if (ae.status === 401) setError(t('settings.passwordWrong'))
            else if (ae.status === 429) {
                setError(ae.retryAfter ? t('login.rateLimited', { seconds: ae.retryAfter }) : t('login.rateLimitedNoTime'))
            } else if (ae.status === 400) setError(t('settings.passwordRejected', { reason: ae.message }))
            else setError(t('common.error'))
        } finally {
            setBusy(false)
        }
    }

    const end = async (id: string) => {
        try {
            await endSession(id)
            toasts.show({ message: t('settings.sessionEnded'), variant: 'success', duration: 2500 })
            await loadSessions()
        } catch {
            toasts.show({ message: t('common.error'), variant: 'danger' })
        }
    }

    return (
        <>
            <p className="wm-settings__lead">{t('settings.account', { address: session.address })}</p>
            <tc-section-card title={t('settings.password')} icon="KeyRound">
                <form className="wm-settings__form" onSubmit={submit} noValidate>
                    <tc-notice tone="muted" text={t('settings.passwordNote')}></tc-notice>
                    <tc-form-input
                        type="password"
                        label={t('settings.currentPassword')}
                        autocomplete="current-password"
                        value={current}
                        ontc-change={(e) => setCurrent(String(e.detail.value ?? ''))}
                    ></tc-form-input>
                    <div className="wm-grid-2">
                        <tc-form-input
                            type="password"
                            label={t('settings.newPassword')}
                            autocomplete="new-password"
                            value={next}
                            ontc-change={(e) => setNext(String(e.detail.value ?? ''))}
                        ></tc-form-input>
                        <tc-form-input
                            type="password"
                            label={t('settings.repeatPassword')}
                            autocomplete="new-password"
                            value={repeat}
                            ontc-change={(e) => setRepeat(String(e.detail.value ?? ''))}
                        ></tc-form-input>
                    </div>
                    {error ? (
                        <p className="wm-error" role="alert">
                            {error}
                        </p>
                    ) : null}
                    <tc-button type="submit" variant="primary" size="sm" loading={busy} disabled={!current || !next || undefined}>
                        {t('settings.passwordSubmit')}
                    </tc-button>
                </form>
            </tc-section-card>

            <tc-section-card title={t('settings.sessions')} icon="MonitorSmartphone">
                {sessions === null ? (
                    <tc-spinner label={t('common.loading')}></tc-spinner>
                ) : (
                    <ul className="wm-plain-list">
                        {sessions.map((s) => (
                            <li key={s.id} className="wm-plain-list__row">
                                <span className="wm-session__info">
                                    <span className="wm-session__agent">
                                        {s.userAgent || s.ip}
                                        {s.current ? <tc-badge variant="success" text={t('settings.sessionCurrent')}></tc-badge> : null}
                                    </span>
                                    <span className="wm-session__meta">
                                        {s.ip} · {t('settings.sessionCreated', { date: formatLongDate(s.createdAt) })} ·{' '}
                                        {t('settings.sessionLastUsed', { date: formatLongDate(s.lastUsedAt) })}
                                    </span>
                                </span>
                                {!s.current ? (
                                    <tc-button size="sm" variant="danger" outline onClick={() => void end(s.id)}>
                                        {t('settings.sessionEnd')}
                                    </tc-button>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                )}
            </tc-section-card>
        </>
    )
}

const TABS: { id: Tab; label: MessageKey }[] = [
    { id: 'general', label: 'settings.tab.general' },
    { id: 'identity', label: 'settings.tab.identity' },
    { id: 'vacation', label: 'settings.tab.vacation' },
    { id: 'security', label: 'settings.tab.security' },
]

/** Settings as the dashboard lays out a profile: a tab rail, then section cards. */
export function SettingsView({ onBack, onPasswordChanged }: { onBack: () => void; onPasswordChanged: () => void }) {
    const [tab, setTab] = useState<Tab>('general')
    const tabs = useMemo(() => TABS.map((x) => ({ id: x.id, label: t(x.label) })), [])
    const rail = useTc<HTMLElement>(
        { tabs },
        {
            'tc-change': (e: Event) => {
                const id = (e as CustomEvent<{ id: string }>).detail?.id
                if (TABS.some((x) => x.id === id)) setTab(id as Tab)
            },
        },
    )
    return (
        <section className="wm-settings" aria-labelledby="wm-settings-title">
            <div className="wm-settings__head">
                <tc-icon-button icon="ChevronLeft" label={t('common.back')} ontc-click={onBack}></tc-icon-button>
                <h2 id="wm-settings-title" className="wm-settings__title">
                    {t('settings.title')}
                </h2>
            </div>
            <tc-page-tabs ref={rail} className="wm-settings__tabs" active-id={tab} aria-label={t('settings.title')}></tc-page-tabs>
            <div className="wm-settings__panel" role="tabpanel" id={`wm-tabpanel-${tab}`}>
                {tab === 'general' ? <General /> : null}
                {tab === 'identity' ? <Identities /> : null}
                {tab === 'vacation' ? <Vacation /> : null}
                {tab === 'security' ? <Security onPasswordChanged={onPasswordChanged} /> : null}
            </div>
        </section>
    )
}
