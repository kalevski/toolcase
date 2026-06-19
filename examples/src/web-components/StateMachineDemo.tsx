import React from 'react'

const fullStates = [
    {
        id: 'provision',
        label: 'Provision',
        description: 'Allocate cloud resources and configure networking',
        status: 'done',
    },
    {
        id: 'build',
        label: 'Build',
        description: 'Compile source, bundle assets, run unit tests',
        status: 'done',
    },
    {
        id: 'deploy',
        label: 'Deploy',
        description: 'Push image to registry and roll out to cluster',
        status: 'active',
    },
    {
        id: 'verify',
        label: 'Verify',
        description: 'Run smoke tests and health checks',
        status: 'pending',
    },
    {
        id: 'notify',
        label: 'Notify',
        description: 'Send release summary to #releases channel',
        status: 'pending',
    },
]

const withErrorStates = [
    { id: 'checkout', label: 'Checkout', description: 'Clone repository at HEAD', status: 'done' },
    {
        id: 'install',
        label: 'Install dependencies',
        description: 'npm ci --prefer-offline',
        status: 'done',
    },
    { id: 'lint', label: 'Lint', description: 'eslint + tsc --noEmit', status: 'error' },
    { id: 'test', label: 'Test', description: 'vitest run --reporter=verbose', status: 'pending' },
]

const StateMachineDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="StateMachine"
                        description="Vertical state-progression display with per-state status markers. Set states via the JS states property."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Mixed statuses (done / active / pending)">
                            {/* @ts-ignore */}
                            <tc-state-machine
                                ref={(el) => {
                                    if (el) (el as any).states = fullStates
                                }}
                                style={{ maxWidth: '480px' }}
                            />
                        </tc-section-card>

                        <tc-section-card title="With error state">
                            {/* @ts-ignore */}
                            <tc-state-machine
                                ref={(el) => {
                                    if (el) (el as any).states = withErrorStates
                                }}
                                style={{ maxWidth: '480px' }}
                            />
                        </tc-section-card>

                        <tc-section-card title="Compact (descriptions hidden, tighter spacing)">
                            {/* @ts-ignore */}
                            <tc-state-machine
                                compact
                                ref={(el) => {
                                    if (el) (el as any).states = fullStates
                                }}
                                style={{ maxWidth: '320px' }}
                            />
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default StateMachineDemo
