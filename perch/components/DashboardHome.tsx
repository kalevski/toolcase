// Placeholder content for the dashboard shell's content region. The site list,
// create-site wizard, and quota panels arrive in later tasks (733–736); for the
// shell milestone this just confirms children render inside the frame.
export function DashboardHome() {
    return (
        <section style={{ maxWidth: '48rem' }}>
            <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Your sites</h1>
            <p style={{ margin: 0, color: '#6b7280' }}>
                Sign-in and the app shell are wired up. Pick a repository and branch to publish your
                first static site — the create-site wizard lands next.
            </p>
        </section>
    )
}
