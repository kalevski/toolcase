import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Not found' }

// App-wide 404. A plain, dependency-free page (no tc-* / no auth) so it renders
// even when the route never matched a real page.
export default function NotFound() {
    return (
        <div className="voxscribe-notfound">
            <p className="voxscribe-notfound-code">404</p>
            <h1 className="voxscribe-notfound-title">Page not found</h1>
            <p className="voxscribe-notfound-lead">The page you’re looking for doesn’t exist or has moved.</p>
            <Link className="voxscribe-notfound-link" href="/">
                ← Back to the dashboard
            </Link>
        </div>
    )
}
