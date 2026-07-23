import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const BriefCardDemo: React.FC = () => {
    const [lastClicked, setLastClicked] = useState<string | null>(null)
    const clickableRef = useTcEvents<HTMLElement>({
        'tc-click': (e: CustomEvent) => {
            setLastClicked(e.detail.id ?? '(no id)')
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="BriefCard"
                            description="A card displaying a task brief with a difficulty indicator, body, optional icon, and meta info. Supports easy/medium/hard difficulties, lucide icons via the icon attribute, named slots for rich content, and a tc-click event when interactive."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Difficulty variants">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-brief-card
                                        brief-id="TASK-001"
                                        difficulty="easy"
                                        title="Set up project scaffolding"
                                        body="Initialise the repository, install dependencies, and configure the build pipeline."
                                        meta-left="3 pts"
                                        meta-right="Frontend"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-brief-card
                                        brief-id="TASK-042"
                                        difficulty="medium"
                                        title="Implement authentication flow"
                                        body="Wire up OAuth2 login and protect API routes with JWT validation middleware."
                                        meta-left="8 pts"
                                        meta-right="Backend"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-brief-card
                                        brief-id="TASK-099"
                                        difficulty="hard"
                                        title="Optimise database query performance"
                                        body="Profile slow queries, add missing indexes, and introduce result caching where appropriate."
                                        meta-left="13 pts"
                                        meta-right="Database"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="With lucide icon (icon attribute)">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-brief-card
                                        brief-id="TASK-007"
                                        difficulty="easy"
                                        icon="FileText"
                                        title="Write release notes"
                                        body="Summarise the changes shipped in v2.0 and publish them to the changelog."
                                        meta-left="2 pts"
                                        meta-right="Docs"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-brief-card
                                        brief-id="TASK-023"
                                        difficulty="medium"
                                        icon="Shield"
                                        title="Add rate limiting"
                                        body="Protect public endpoints with a sliding-window rate limiter backed by Redis."
                                        meta-left="5 pts"
                                        meta-right="Security"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Slotted icon and title">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-brief-card
                                        brief-id="TASK-055"
                                        difficulty="hard"
                                        body="Design the migration strategy for sharding the users table across two database clusters."
                                        meta-left="21 pts"
                                        meta-right="Infra"
                                    >
                                        <span slot="icon" style={{ display: 'inline-flex' }}>
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
                                                <ellipse cx="12" cy="5" rx="9" ry="3" />
                                                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                                                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                                            </svg>
                                        </span>
                                        <strong slot="title">Shard the users table</strong>
                                    </tc-brief-card>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Clickable card (tc-click event)">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 480 }}>
                                    {/* @ts-ignore */}
                                    <tc-brief-card
                                        ref={clickableRef}
                                        brief-id="TASK-012"
                                        difficulty="medium"
                                        icon="Zap"
                                        clickable
                                        title="Enable server-side rendering"
                                        body="Add SSR support to the landing page to improve first-contentful-paint scores."
                                        meta-left="8 pts"
                                        meta-right="Performance"
                                    />
                                    {lastClicked && (
                                        <p
                                            className="mt-2 mb-0"
                                            style={{
                                                fontFamily: 'var(--bs-font-monospace)',
                                                fontSize: '0.825rem',
                                                color: 'var(--tc-text-muted)',
                                            }}
                                        >
                                            Last tc-click → id: <strong>{lastClicked}</strong>
                                        </p>
                                    )}
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BriefCardDemo
