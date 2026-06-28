import type { Metadata } from 'next'
import '@toolcase/web-components/style.css'
import '@toolcase/web-components/react' // side-effect: global JSX typings for tc-* tags
import './globals.css'
import { Providers } from '@/app/providers'
import { getPublicSettings } from '@/server/services/settings'
import { DEFAULT_SETTINGS } from '@/server/domain/settings'

// Title + description follow the owner-set application name so a renamed instance
// re-brands the browser tab everywhere (the template applies the name to every page).
// Defensive: the DB may be unavailable at build time → fall back to defaults.
export function generateMetadata(): Metadata {
    let appName = DEFAULT_SETTINGS.appName
    let tagline = DEFAULT_SETTINGS.tagline
    try {
        const s = getPublicSettings()
        appName = s.appName
        tagline = s.tagline
    } catch {
        /* DB not ready — keep defaults */
    }
    return {
        title: {
            default: appName,
            template: `%s · ${appName}`,
        },
        description: tagline,
    }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}
