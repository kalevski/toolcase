import type { Metadata } from 'next'
import '@toolcase/web-components/style.css'
import '@toolcase/web-components/react' // side-effect: global JSX typings for tc-* tags
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
    title: {
        default: 'Perch',
        template: '%s · Perch',
    },
    description: 'Control plane that deploys a GitHub branch as a static site via nginxpilot.',
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
