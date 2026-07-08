import type { Metadata } from 'next'
import '@toolcase/web-components/style.css'
import '@toolcase/web-components/react' // side-effect: global JSX typings for tc-* tags
import './globals.css'
import { Providers } from './providers'
import { BrandingProvider } from '@/lib/branding-context'
import { DEFAULT_SETTINGS } from '@/server/domain/settings'

// Tab title + description follow the admin-set app name (Settings). Read
// server-side per request from the settings service; fall back to the defaults
// during the build trace (no DB yet) or if the read throws, so metadata never
// breaks a render.
export async function generateMetadata(): Promise<Metadata> {
    let appName = DEFAULT_SETTINGS.appName
    let tagline = DEFAULT_SETTINGS.tagline
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
        try {
            const { getSettings } = await import('@/server/services/settings')
            const s = getSettings()
            appName = s.appName
            tagline = s.tagline
        } catch {
            /* keep defaults */
        }
    }
    return {
        title: { default: appName, template: `%s · ${appName}` },
        description: tagline,
    }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <BrandingProvider>
                    <Providers>{children}</Providers>
                </BrandingProvider>
            </body>
        </html>
    )
}
