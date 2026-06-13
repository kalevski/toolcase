import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const TeamListDemo: React.FC = () => {
    const derivedRef = useRef<any>(null)
    const explicitRef = useRef<any>(null)
    const imgRef = useRef<any>(null)
    const rolesRef = useRef<any>(null)
    const mixedRef = useRef<any>(null)

    useEffect(() => {
        if (derivedRef.current) {
            derivedRef.current.members = [
                { id: '1', name: 'Alice Johnson' },
                { id: '2', name: 'Bob Smith' },
                { id: '3', name: 'Carol White' },
            ]
        }
    }, [])

    useEffect(() => {
        if (explicitRef.current) {
            explicitRef.current.members = [
                { id: '1', name: 'Dave Kumar', initials: 'DK', email: 'dave@example.com' },
                { id: '2', name: 'Eva Müller', initials: 'EM', email: 'eva@example.com' },
            ]
        }
    }, [])

    useEffect(() => {
        if (imgRef.current) {
            imgRef.current.members = [
                {
                    id: '1',
                    name: 'Frank Lee',
                    email: 'frank@example.com',
                    avatarUrl: 'https://i.pravatar.cc/64?img=3',
                },
                {
                    id: '2',
                    name: 'Grace Park',
                    email: 'grace@example.com',
                    avatarUrl: 'https://i.pravatar.cc/64?img=5',
                },
            ]
        }
    }, [])

    useEffect(() => {
        if (rolesRef.current) {
            rolesRef.current.members = [
                { id: '1', name: 'Henry Zhao', email: 'henry@example.com', role: 'Engineering' },
                { id: '2', name: 'Iris Nakamura', email: 'iris@example.com', role: 'Design' },
                { id: '3', name: 'Jack Rivera', email: 'jack@example.com', role: 'Product' },
            ]
        }
    }, [])

    useEffect(() => {
        if (mixedRef.current) {
            mixedRef.current.members = [
                { id: '1', name: 'Kate Moore', email: 'kate@example.com', role: 'Lead', gradient: true },
                { id: '2', name: 'Liam Scott', initials: 'LS', email: 'liam@example.com', role: 'Backend', gradient: true },
                { id: '3', name: 'Mia Chen', email: 'mia@example.com', avatarUrl: 'https://i.pravatar.cc/64?img=9', role: 'Frontend' },
                { id: '4', name: 'Noah Patel', email: 'noah@example.com', role: 'DevOps', gradient: true },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="TeamList"
                            description="List of team members with gradient avatar tiles, names, emails, and optional role chips. Members are set via the JS members property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Derived initials (gradient avatars)">
                                {/* @ts-ignore */}
                                <tc-team-list ref={derivedRef} style={{ maxWidth: '480px' }} />
                            </SectionCard>

                            <SectionCard title="Explicit initials + emails">
                                {/* @ts-ignore */}
                                <tc-team-list ref={explicitRef} style={{ maxWidth: '480px' }} />
                            </SectionCard>

                            <SectionCard title="Image avatars">
                                {/* @ts-ignore */}
                                <tc-team-list ref={imgRef} style={{ maxWidth: '480px' }} />
                            </SectionCard>

                            <SectionCard title="With roles">
                                {/* @ts-ignore */}
                                <tc-team-list ref={rolesRef} style={{ maxWidth: '480px' }} />
                            </SectionCard>

                            <SectionCard title="Mixed (gradient, explicit initials, image avatar, roles)">
                                {/* @ts-ignore */}
                                <tc-team-list ref={mixedRef} style={{ maxWidth: '480px' }} />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TeamListDemo
