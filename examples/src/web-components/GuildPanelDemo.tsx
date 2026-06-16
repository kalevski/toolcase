import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ROSTER = [
    { id: '1', name: 'Aria Vex', rank: 'Leader', online: true, contribution: 48230 },
    { id: '2', name: 'Kestrel', rank: 'Officer', online: true, contribution: 31540 },
    { id: '3', name: 'Vesper Holt', rank: 'Veteran', online: false, contribution: 22810 },
    { id: '4', name: 'Onyx', rank: 'Member', online: false, contribution: 9120 },
    { id: '5', name: 'Lyra Sol', rank: 'Recruit', online: true, contribution: 1450 },
]

function panelFrame(children: React.ReactNode) {
    return <div style={{ maxWidth: 360 }}>{children}</div>
}

function FullExample() {
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.members = ROSTER
    }, [])

    return panelFrame(
        /* @ts-ignore */
        <tc-guild-panel
            ref={ref}
            guild-name="Iron Vanguard"
            tag="IRON"
            motto="No retreat, no surrender."
            level={42}
            member-cap={50}
        />
    )
}

function MinimalExample() {
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.members = [
            { id: '1', name: 'Aria Vex', online: true },
            { id: '2', name: 'Kestrel', online: false },
        ]
    }, [])

    return panelFrame(
        /* @ts-ignore */
        <tc-guild-panel ref={ref} guild-name="Night Owls" />
    )
}

const GuildPanelDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                        title="GuildPanel"
                        description="Guild / clan panel with a header (name, tag, motto), a stats strip (level, members, online), and a member roster. The roster is set via the members JS property. Restyled from the game-components gc-guild-panel to the toolcase design system: slate neutrals, hairline borders, sharp corners, and JetBrains Mono for stat values and rank chips."
                    />

                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Full panel — name, tag, motto, level, cap, roster">
                            <FullExample />
                        </SectionCard>

                        <SectionCard title="Minimal — name + roster only (no tag, motto, level, or cap)">
                            <MinimalExample />
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default GuildPanelDemo
