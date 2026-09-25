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
        name: 'nginxpilot',
        description:
            'Go daemon that keeps nginx sites and PHP apps in sync with git repositories or HTTP zip archives. Atomic symlink deploys, last known-good on failure — and an opt-in managed mode that writes, validates and reloads the nginx config itself.',
        path: '/apps/nginxpilot',
        meta: ['Go', 'Daemon', 'git · http-zip', 'managed nginx'],
    },
    {
        name: 'zonewright',
        description:
            'Go daemon that owns authoritative BIND 9 zones and manages their records over an HTTP API. Every change is checked with named-checkzone before it goes live, and several servers replicate to each other — your own ns1/ns2.',
        path: '/apps/zonewright',
        meta: ['Go', 'Daemon', 'BIND 9', 'multi-master'],
    },
    {
        name: 'imagewarden',
        description:
            'Local-only image safety classifier: one Go binary in one read-only container, a quantized MobileNetV2 on CPU, and an allow / review / block verdict per image. No cloud call, no disk writes, zero network egress.',
        path: '/apps/imagewarden',
        meta: ['Go', 'Service', 'ONNX Runtime'],
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
