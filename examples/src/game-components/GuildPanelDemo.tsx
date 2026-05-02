import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const MEMBERS = [
    { id: '1', name: 'Aldric', rank: 'Guildmaster', online: true, contribution: 12400 },
    { id: '2', name: 'Brina', rank: 'Officer', online: true, contribution: 8200 },
    { id: '3', name: 'Caelum', rank: 'Veteran', online: false, contribution: 5400 },
    { id: '4', name: 'Dorin', rank: 'Member', online: true, contribution: 1200 },
    { id: '5', name: 'Eira', rank: 'Member', online: false, contribution: 600 }
]

const GuildPanelDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.members = MEMBERS
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="GuildPanel"
                        description="Guild header with name, tag, motto, level, and online roster."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Default" />
                            <div style={{ maxWidth: 560 }}>
                                {/* @ts-ignore */}
                                <gc-guild-panel ref={ref} guild-name="Order of the Ember" tag="EMB" motto="By flame and faith." level="14" member-cap="50" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GuildPanelDemo
