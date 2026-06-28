import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Not found' }

// App-wide 404 — dependency-free (no tc-* / no auth) so it renders even when the
// route never matched a real page.
export default function NotFound() {
    return (
        <div className="wharf-notfound">
            <p className="wharf-notfound-code">404</p>
            <h1 className="wharf-notfound-title">Page not found</h1>
            <p className="wharf-notfound-lead">The page you’re looking for doesn’t exist or has moved.</p>
            <Link className="wharf-notfound-link" href="/">
                ← Back to your projects
            </Link>
        </div>
    )
}
