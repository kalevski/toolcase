import React from 'react'
import {
    RichPageHeader,
    RichPageHeaderChip,
    SectionCard,
    TeamList,
} from '@toolcase/react-components'

const TeamListDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
                    title="TeamList"
                    description="Flat table-style list of team members with initialed avatars, email, and role. Avatars accept a two-stop gradient for variety."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    <SectionCard title="Workspace members">
                        <TeamList
                            members={[
                                {
                                    initials: 'AK',
                                    email: 'alice@acme.io',
                                    role: 'Owner',
                                    gradient: ['#6366f1', '#a855f7'],
                                },
                                {
                                    initials: 'BL',
                                    email: 'ben@acme.io',
                                    role: 'Admin',
                                    gradient: ['#06b6d4', '#3b82f6'],
                                },
                                {
                                    initials: 'CM',
                                    email: 'chris@acme.io',
                                    role: 'Member',
                                    gradient: ['#10b981', '#22c55e'],
                                },
                                {
                                    initials: 'DN',
                                    email: 'dani@acme.io',
                                    role: 'Billing',
                                    gradient: ['#f59e0b', '#ef4444'],
                                },
                            ]}
                        />
                    </SectionCard>

                    <SectionCard title="No gradient (neutral)">
                        <TeamList
                            members={[
                                { initials: 'EV', email: 'eve@acme.io', role: 'Viewer' },
                                { initials: 'FG', email: 'fin@acme.io', role: 'Viewer' },
                            ]}
                        />
                    </SectionCard>
                </div>
            </div>
        </div>
    </div>
)

export default TeamListDemo
