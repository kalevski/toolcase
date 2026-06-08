import Link from 'next/link'

export default function NotFound() {
    return (
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <h1>404</h1>
                <p>That page or resource was not found.</p>
                <Link href="/">Back to dashboard</Link>
            </div>
        </div>
    )
}
