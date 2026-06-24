import type { Metadata } from 'next'
import '@toolcase/web-components/style.css'
import '@toolcase/web-components/react' // side-effect: global JSX typings for tc-* tags
import './globals.css'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
    title: {
        default: 'TaskForge',
        template: '%s · TaskForge',
    },
    description: 'Self-hosted control panel that drives the Claude Code CLI over local git repositories.',
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
