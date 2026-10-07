import type { ReactNode } from 'react'
import type { Branding } from '../api/session'
import { t } from '../i18n'
import { BrandMark } from './BrandMark'

/**
 * The sign-in frame: a stage in the tone of the domain this webmail is served for, its name set large as the
 * wordmark, over the fine woven lining of a business envelope; and the form on plain paper beside it.
 */
export function AuthLayout({ branding, title, children }: { branding: Branding; title: string; children: ReactNode }) {
    return (
        <main className="wm-login">
            <section className="wm-stage">
                <div className="wm-stage__hero">
                    <BrandMark branding={branding} size="hero" />
                    <p className="wm-stage__domain">
                        {branding.known ? t('login.stageKnown', { domain: branding.domain }) : t('login.stageNeutral')}
                    </p>
                </div>
            </section>
            <section className="wm-card wm-login__panel">
                <div className="wm-card__body">
                    <h1 className="wm-card__title wm-login__title">{title}</h1>
                    {children}
                </div>
            </section>
        </main>
    )
}
