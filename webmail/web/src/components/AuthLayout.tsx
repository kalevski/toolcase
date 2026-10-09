import type { ReactNode } from 'react'
import type { Branding } from '../api/session'
import { t } from '../i18n'
import { BrandMark } from './BrandMark'

type Props = {
    branding: Branding
    title: string
    lead?: string
    footer?: ReactNode
    children: ReactNode
}

/**
 * The sign-in frame, the dashboard's login: the form on a white card and, beside it on a wide screen, a dark
 * stage in the tone of the domain's accent with its wordmark, what this page is for, and the domain's facts.
 */
export function AuthLayout({ branding, title, lead, footer, children }: Props) {
    const known = branding.known
    const scope =
        branding.signInScope === 'domain'
            ? t('login.scopeDomain', { domain: branding.domain })
            : t('login.scopeAny')
    return (
        <main className="wm-login">
            <section className="wm-login__card">
                <header className="wm-login__card-head">
                    <BrandMark branding={branding} />
                    {known ? <span className="wm-login__host">{branding.domain}</span> : null}
                </header>
                <div className="wm-login__body">
                    <h1 className="wm-login__title">{title}</h1>
                    {lead ? <p className="wm-login__lead">{lead}</p> : null}
                    {children}
                </div>
                {footer ? <footer className="wm-login__foot">{footer}</footer> : null}
            </section>

            <section className="wm-login__stage">
                <header className="wm-login__stage-head">
                    <BrandMark branding={branding} />
                </header>
                <div className="wm-login__stage-body">
                    <p className="wm-login__eyebrow">{known ? branding.domain : t('app.name')}</p>
                    <h2 className="wm-login__stage-title">
                        {known ? t('login.stageKnown', { domain: branding.domain }) : t('login.stageNeutral')}
                    </h2>
                    <p className="wm-login__stage-lead">{t('login.stageLead')}</p>
                    {known ? (
                        <dl className="wm-login__facts">
                            <div className="wm-login__fact">
                                <dt>{t('login.factDomain')}</dt>
                                <dd>{branding.domain}</dd>
                            </div>
                            <div className="wm-login__fact">
                                <dt>{t('login.factScope')}</dt>
                                <dd>{scope}</dd>
                            </div>
                            {branding.supportEmail ? (
                                <div className="wm-login__fact">
                                    <dt>{t('login.factSupport')}</dt>
                                    <dd>{branding.supportEmail}</dd>
                                </div>
                            ) : null}
                        </dl>
                    ) : null}
                </div>
            </section>
        </main>
    )
}
