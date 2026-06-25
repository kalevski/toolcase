import type { Metadata } from 'next'

export const runtime = 'nodejs'

export const metadata: Metadata = { title: 'Home' }

export default function HomePage() {
    return (
        <main style={{ maxWidth: '42rem', margin: '4rem auto', padding: '0 1.5rem' }}>
            <h1>Perch</h1>
            <p>
                Control plane that deploys a GitHub branch as a static site via nginxpilot. This is a
                scaffold — no business logic, database, or auth yet.
            </p>
        </main>
    )
}
