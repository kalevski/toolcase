import type { Branding } from '../api/session'
import { t } from '../i18n'
import { isEmail, isHttpUrl } from '../util/safe'

/** Support contacts and footer links from branding data, validated per link; flat anchors for the sign-in foot. */
export function BrandFooter({ branding }: { branding: Branding }) {
    const links = branding.footerLinks.filter((l) => isHttpUrl(l.url))
    const supportUrl = isHttpUrl(branding.supportUrl) ? branding.supportUrl : ''
    const supportEmail = isEmail(branding.supportEmail) ? branding.supportEmail : ''
    if (!links.length && !supportUrl && !supportEmail) return null
    return (
        <>
            {supportUrl ? (
                <a href={supportUrl} target="_blank" rel="noopener noreferrer">
                    {t('login.support')}
                </a>
            ) : null}
            {supportEmail ? <a href={`mailto:${supportEmail}`}>{supportUrl ? supportEmail : t('login.supportEmail')}</a> : null}
            {links.map((l) => (
                <a key={l.url + l.label} href={l.url} target="_blank" rel="noopener noreferrer">
                    {l.label}
                </a>
            ))}
        </>
    )
}
