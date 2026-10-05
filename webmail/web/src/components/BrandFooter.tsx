import type { Branding } from '../api/session'
import { t } from '../i18n'
import { isEmail, isHttpUrl } from '../util/safe'

/** Footer links and support contacts from branding data, validated per link. */
export function BrandFooter({ branding }: { branding: Branding }) {
    const links = branding.footerLinks.filter((l) => isHttpUrl(l.url))
    const supportUrl = isHttpUrl(branding.supportUrl) ? branding.supportUrl : ''
    const supportEmail = isEmail(branding.supportEmail) ? branding.supportEmail : ''
    if (!links.length && !supportUrl && !supportEmail) return null
    return (
        <footer className="wm-brand-footer">
            {supportUrl || supportEmail ? (
                <p className="wm-brand-footer__support">
                    {supportUrl ? (
                        <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                            {t('login.support')}
                        </a>
                    ) : null}
                    {supportEmail ? (
                        <a href={`mailto:${supportEmail}`}>
                            {supportUrl ? supportEmail : t('login.supportEmail')}
                        </a>
                    ) : null}
                </p>
            ) : null}
            {links.length ? (
                <nav aria-label={t('login.footer')}>
                    <ul className="wm-brand-footer__links">
                        {links.map((l) => (
                            <li key={l.url + l.label}>
                                <a href={l.url} target="_blank" rel="noopener noreferrer">
                                    {l.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            ) : null}
        </footer>
    )
}
