import React from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const fullStates = [
    { id: 'provision', label: 'Provision', description: 'Allocate cloud resources and configure networking', status: 'done' },
    { id: 'build', label: 'Build', description: 'Compile source, bundle assets, run unit tests', status: 'done' },
    { id: 'deploy', label: 'Deploy', description: 'Push image to registry and roll out to cluster', status: 'active' },
    { id: 'verify', label: 'Verify', description: 'Run smoke tests and health checks', status: 'pending' },
    { id: 'notify', label: 'Notify', description: 'Send release summary to #releases channel', status: 'pending' },
]

const withErrorStates = [
    { id: 'checkout', label: 'Checkout', description: 'Clone repository at HEAD', status: 'done' },
    { id: 'install', label: 'Install dependencies', description: 'npm ci --prefer-offline', status: 'done' },
    { id: 'lint', label: 'Lint', description: 'eslint + tsc --noEmit', status: 'error' },
    { id: 'test', label: 'Test', description: 'vitest run --reporter=verbose', status: 'pending' },
]

const StateMachineDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="StateMachine"
                        description="Vertical state-progression display with per-state status markers. Set states via the JS states property."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Mixed statuses (done / active / pending)">
                            {/* @ts-ignore */}
                            <tc-state-machine ref={el => { if (el) el.states = fullStates }} style={{ maxWidth: '480px' }} />
                        </SectionCard>

                        <SectionCard title="With error state">
                            {/* @ts-ignore */}
                            <tc-state-machine ref={el => { if (el) el.states = withErrorStates }} style={{ maxWidth: '480px' }} />
                        </SectionCard>

                        <SectionCard title="Compact (descriptions hidden, tighter spacing)">
                            {/* @ts-ignore */}
                            <tc-state-machine compact ref={el => { if (el) el.states = fullStates }} style={{ maxWidth: '320px' }} />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default StateMachineDemo
