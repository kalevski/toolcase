import React from 'react'

const FeatureCardDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="FeatureCard"
                            description="A card highlighting a feature with optional icon, eyebrow, title, description, and visual area. Supports default/wide/full sizes, an inline horizontal layout, lucide icons via the icon attribute, and named slots for rich content."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default size — icon + eyebrow + title + description">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-feature-card
                                        icon="Zap"
                                        eyebrow="Performance"
                                        title="Lightning-fast builds"
                                        description="Incremental compilation and persistent caching cut build times by up to 80%."
                                    />
                                    {/* @ts-ignore */}
                                    <tc-feature-card
                                        icon="Shield"
                                        eyebrow="Security"
                                        title="Zero-trust by default"
                                        description="Every request is authenticated and authorised at the edge before reaching your services."
                                    />
                                    {/* @ts-ignore */}
                                    <tc-feature-card
                                        icon="Globe"
                                        eyebrow="Delivery"
                                        title="Global edge network"
                                        description="Deploy to 100+ points of presence with automatic failover and sub-50 ms latency."
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Wide size">
                                <div className="d-flex flex-column gap-3">
                                    {/* @ts-ignore */}
                                    <tc-feature-card
                                        size="wide"
                                        icon="Database"
                                        eyebrow="Storage"
                                        title="Managed distributed database"
                                        description="Automatic sharding, replication, and backups. Scales from megabytes to petabytes without configuration changes."
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Full size">
                                {/* @ts-ignore */}
                                <tc-feature-card
                                    size="full"
                                    icon="BarChart2"
                                    eyebrow="Observability"
                                    title="End-to-end tracing"
                                    description="Distributed tracing, structured logs, and real-time metrics in one unified dashboard. Spot bottlenecks before they become incidents."
                                />
                            </tc-section-card>

                            <tc-section-card title="Inline layout (icon beside copy)">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 540 }}>
                                    {/* @ts-ignore */}
                                    <tc-feature-card
                                        inline
                                        icon="CheckCircle"
                                        eyebrow="Reliability"
                                        title="99.99% uptime SLA"
                                        description="Backed by multi-region redundancy and automated health checks."
                                    />
                                    {/* @ts-ignore */}
                                    <tc-feature-card
                                        inline
                                        icon="Code2"
                                        eyebrow="Developer experience"
                                        title="Type-safe SDK"
                                        description="Full TypeScript coverage with generated types from your API schema."
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Slotted icon and visual">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-feature-card
                                        eyebrow="Custom Branding"
                                        title="Your logo, your colours"
                                        description="Upload a logo and pick accent colours — every customer-facing surface reflects your brand instantly."
                                    >
                                        <span
                                            slot="icon"
                                            style={{
                                                display: 'inline-flex',
                                                color: 'var(--tc-text)',
                                            }}
                                        >
                                            <svg
                                                aria-hidden="true"
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="18"
                                                height="18"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <circle
                                                    cx="13.5"
                                                    cy="6.5"
                                                    r="0.5"
                                                    fill="currentColor"
                                                />
                                                <circle
                                                    cx="17.5"
                                                    cy="10.5"
                                                    r="0.5"
                                                    fill="currentColor"
                                                />
                                                <circle
                                                    cx="8.5"
                                                    cy="7.5"
                                                    r="0.5"
                                                    fill="currentColor"
                                                />
                                                <circle
                                                    cx="6.5"
                                                    cy="12.5"
                                                    r="0.5"
                                                    fill="currentColor"
                                                />
                                                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                                            </svg>
                                        </span>
                                        <div
                                            slot="visual"
                                            style={{
                                                height: 96,
                                                background: 'var(--tc-surface-muted)',
                                                border: '1px solid var(--tc-border)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontFamily: 'var(--bs-font-monospace)',
                                                fontSize: '0.75rem',
                                                color: 'var(--tc-text-faint)',
                                                letterSpacing: '0.05em',
                                            }}
                                        >
                                            VISUAL SLOT
                                        </div>
                                    </tc-feature-card>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Inline with slotted title">
                                <div style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-feature-card
                                        inline
                                        icon="Layers"
                                        eyebrow="Architecture"
                                        description="Compose features from independently deployable microservices without the operational overhead."
                                    >
                                        <strong slot="title">Micro-services made simple</strong>
                                    </tc-feature-card>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FeatureCardDemo
