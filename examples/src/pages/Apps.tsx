import { Fragment } from 'react'
import { Link as RouterLink } from 'react-router'
import { Breadcrumbs } from './_chrome'

type AppEntry = {
    name: string
    description: string
    path: string
    meta: string[]
}

const apps: AppEntry[] = [
    {
        name: 'taskforge',
        description:
            'Self-hosted Next.js control panel that drives the Claude Code CLI over local git repositories. Per-project Markdown task queues, live SSE streaming, survives usage-limit walls, commit + push from the UI. Database-free, GitHub OAuth.',
        path: '/apps/taskforge',
        meta: ['Next.js', 'Claude Code CLI', 'GitHub OAuth · SSE'],
    },
    {
        name: 'nginxpilot',
        description:
            'Go daemon that keeps nginx static site directories in sync with remote sources — git repositories or HTTP zip archives. Atomic symlink deploys, last known-good on failure, never in the request path.',
        path: '/apps/nginxpilot',
        meta: ['Go', 'Daemon', 'git · http-zip'],
    },
]

export const Apps = () => {
    return (
        <main className="site-container">
            <Breadcrumbs current="Apps" />
            <section className="page-intro">
                <div>
                    <div className="eyebrow">Index / Apps</div>
                    <h1 className="page-title">Standalone applications.</h1>
                    <p className="page-lead">
                        Apps developed inside the toolcase monorepo, built on top of @toolcase packages
                        or standing on their own.
                    </p>
                </div>
                <dl className="page-meta">
                    <div>
                        <dt>Apps</dt>
                        <dd>{apps.length}</dd>
                    </div>
                    <div>
                        <dt>Status</dt>
                        <dd><span className="tag accent">Shipping</span></dd>
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
                        <RouterLink key={app.name} to={app.path} className="lib-card">
                            <div className="lib-card-head">
                                <div>
                                    <h3 className="lib-name">{app.name}</h3>
                                    <p className="lib-tagline">{app.description}</p>
                                </div>
                                <span className="lib-arrow">→</span>
                            </div>
                            <div className="lib-meta-row">
                                {app.meta.map((m, i) => (
                                    <Fragment key={m}>
                                        {i > 0 && <span className="sep">·</span>}
                                        <span>{m}</span>
                                    </Fragment>
                                ))}
                            </div>
                        </RouterLink>
                    ))}
                </div>
            )}
        </main>
    )
}
