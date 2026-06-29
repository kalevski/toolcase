import React from 'react'
import '@toolcase/web-components/react'
import { useTc } from '@toolcase/web-components/react'
import type { TeamMember } from '@toolcase/web-components'

// Derived initials, gradient avatars, roles, and emails.
const TEAM: TeamMember[] = [
    { id: '1', name: 'Alice Chen', email: 'alice@toolcase.dev', role: 'Owner' },
    { id: '2', name: 'Bob Müller', email: 'bob@toolcase.dev', role: 'Maintainer' },
    { id: '3', name: 'Carol Diaz', role: 'Contributor' },
    { id: '4', name: 'Dave', email: 'dave@toolcase.dev' },
]

// Explicit initials + an image avatar + a non-gradient (plain) tile.
const MIXED: TeamMember[] = [
    { id: '1', name: 'Grace Park', email: 'grace@toolcase.dev', role: 'Reviewer', initials: 'GP' },
    {
        id: '2',
        name: 'Heidi Novak',
        email: 'heidi@toolcase.dev',
        avatarUrl: 'https://i.pravatar.cc/96?img=47',
    },
    { id: '3', name: 'Ivan Petrov', role: 'Contributor', gradient: false },
]

const TeamListDemo: React.FC = () => {
    const teamRef = useTc<HTMLElement>({ members: TEAM })
    const mixedRef = useTc<HTMLElement>({ members: MIXED })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Team List"
                            description="List of team members with gradient avatar tiles, names, optional emails, and optional role chips. Driven entirely by the members JS property."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Names, emails, roles (derived initials)">
                                <tc-team-list ref={teamRef} />
                            </tc-section-card>

                            <tc-section-card title="Explicit initials, image avatar, plain tile">
                                <tc-team-list ref={mixedRef} />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TeamListDemo
