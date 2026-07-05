import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Not found' }

// App-wide 404 (plan WS-5). A plain, dependency-free page (no tc-* / no auth) so it
// renders even when the route never matched a real page.
export default function NotFound() {
    return (
        <div className="quaykeeper-notfound">
            <p className="quaykeeper-notfound-code">404</p>
            <h1 className="quaykeeper-notfound-title">Page not found</h1>
            <p className="quaykeeper-notfound-lead">The page you’re looking for doesn’t exist or has moved.</p>
            <Link className="quaykeeper-notfound-link" href="/">
                ← Back to your sites
            </Link>
        </div>
    )
}
