import type { Metadata } from 'next'
import 'bootstrap-icons/font/bootstrap-icons.css'
import '@toolcase/react-components/style.css'
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
