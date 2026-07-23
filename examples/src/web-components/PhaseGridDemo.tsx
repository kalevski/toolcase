import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const PhaseGridDemo: React.FC = () => {
    const threeColRef = useTc<HTMLElement>({
        phases: [
            {
                title: 'Project Setup',
                description: 'Initialise the repository, CI/CD pipeline, and base tooling.',
                status: 'complete',
                tags: ['infra', 'ci'],
                command: 'npm create toolcase@latest my-app',
            },
            {
                title: 'Core Features',
                description: 'Implement the primary user-facing features and domain logic.',
                status: 'active',
                tags: ['feature', 'v1'],
                command: 'npm run dev',
            },
            {
                title: 'Testing & QA',
                description: 'Full coverage for unit, integration, and end-to-end tests.',
                status: 'upcoming',
                tags: ['testing', 'e2e'],
                command: 'npm test',
            },
        ],
    })
    const twoColRef = useTc<HTMLElement>({
        phases: [
            {
                title: 'Database Migration',
                description: 'Blocked pending upstream schema approval from the platform team.',
                status: 'blocked',
                tags: ['database', 'migration'],
            },
            {
                title: 'Auth Integration',
                description: 'OAuth2/OIDC integration with the identity provider.',
                status: 'upcoming',
                tags: ['auth', 'oauth2'],
                command: 'npx auth setup',
            },
        ],
    })
    const fourColRef = useTc<HTMLElement>({
        phases: [
            { title: 'Planning', status: 'complete', tags: ['meta'] },
            { title: 'Development', status: 'active', command: 'npm run dev' },
            { title: 'Review', status: 'upcoming' },
            { title: 'Deploy', status: 'upcoming', command: 'npm run deploy' },
        ],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="PhaseGrid"
                            description="Grid of phase/timeline cards with status indicators, optional description, tags, and shell commands. Status is conveyed by icon + label — not color alone."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="3 columns — mixed statuses, tags, and commands">
                                {/* @ts-ignore */}
                                <tc-phase-grid columns="3" ref={threeColRef} />
                            </tc-section-card>

                            <tc-section-card title="2 columns — blocked and upcoming">
                                {/* @ts-ignore */}
                                <tc-phase-grid columns="2" ref={twoColRef} />
                            </tc-section-card>

                            <tc-section-card title="4 columns — compact (no descriptions)">
                                {/* @ts-ignore */}
                                <tc-phase-grid columns="4" ref={fourColRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PhaseGridDemo
