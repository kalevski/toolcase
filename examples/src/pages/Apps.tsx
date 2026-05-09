import { Breadcrumbs } from './_chrome'

type AppEntry = {
    name: string
    description: string
    path: string
}

const apps: AppEntry[] = []

export const Apps = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="Apps" />
            <section className="page-intro">
                <div>
                    <div className="eyebrow">Index / Apps</div>
                    <h1 className="page-title">Standalone applications.</h1>
                    <p className="page-lead">
                        Apps developed inside the toolcase monorepo, built on top of @toolcase packages.
                        Nothing shipping yet — placeholder while the first one is in flight.
                    </p>
                </div>
                <dl className="page-meta">
                    <div>
                        <dt>Apps</dt>
                        <dd>{apps.length}</dd>
                    </div>
                    <div>
                        <dt>Status</dt>
                        <dd><span className="tag">Coming soon</span></dd>
                    </div>
                </dl>
            </section>

            {apps.length === 0 ? (
                <div className="empty-state">
                    <span className="mono-tag">No apps yet</span>
                    <h3>Nothing here yet</h3>
                    <p>Apps developed inside the toolcase monorepo will appear here as they ship.</p>
                </div>
            ) : (
                <div className="lib-grid">
                    {apps.map((app) => (
                        <a key={app.name} href={app.path} className="lib-card">
                            <div className="lib-card-head">
                                <div>
                                    <h3 className="lib-name">{app.name}</h3>
                                    <p className="lib-tagline">{app.description}</p>
                                </div>
                                <span className="lib-arrow">→</span>
                            </div>
                        </a>
                    ))}
                </div>
            )}
        </main>
    )
}
