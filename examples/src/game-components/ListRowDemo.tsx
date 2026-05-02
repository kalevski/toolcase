import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

type Server = { id: string; name: string; region: string; ping: number }

const servers: Server[] = [
    { id: 's1', name: 'Ironforge — EU West', region: 'EU', ping: 28 },
    { id: 's2', name: 'Stormwind — US East', region: 'US', ping: 92 },
    { id: 's3', name: 'Orgrimmar — APAC', region: 'AP', ping: 184 },
    { id: 's4', name: 'Darnassus — SA', region: 'SA', ping: 312 },
]

const ListRowDemo: React.FC = () => {
    const [selected, setSelected] = useState<string>('s1')
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = containerRef.current
        if (!el) return
        const onSelect = (event: Event) => {
            const target = event.target as HTMLElement | null
            const id = target?.dataset?.id
            if (id) setSelected(id)
        }
        el.addEventListener('select', onSelect)
        return () => el.removeEventListener('select', onSelect)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="ListRow"
                        description="Selectable list row. Reflects selected attribute. Optional accent color for the left edge stripe. Click/Enter/Space emits 'select'."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Plain rows">
                            {/* @ts-ignore */}
                            <gc-panel bordered>
                                {/* @ts-ignore */}
                                <gc-list-row>
                                    <span style={{ flex: 1 }}>Iron Sword</span>
                                    <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>◈ 120</span>
                                {/* @ts-ignore */}
                                </gc-list-row>
                                {/* @ts-ignore */}
                                <gc-list-row>
                                    <span style={{ flex: 1 }}>Healing Potion</span>
                                    <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>◈ 25</span>
                                {/* @ts-ignore */}
                                </gc-list-row>
                                {/* @ts-ignore */}
                                <gc-list-row>
                                    <span style={{ flex: 1 }}>Leather Boots</span>
                                    <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>◈ 80</span>
                                {/* @ts-ignore */}
                                </gc-list-row>
                                {/* @ts-ignore */}
                            </gc-panel>
                        </SectionCard>

                        <SectionCard title="Selected with custom accent">
                            {/* @ts-ignore */}
                            <gc-panel bordered>
                                {/* @ts-ignore */}
                                <gc-list-row selected accent="var(--fg-mythic)">
                                    <span style={{ flex: 1 }}>Mythic — selected, mythic accent</span>
                                {/* @ts-ignore */}
                                </gc-list-row>
                                {/* @ts-ignore */}
                                <gc-list-row selected accent="var(--fg-blood-bright)">
                                    <span style={{ flex: 1 }}>Danger — selected, blood accent</span>
                                {/* @ts-ignore */}
                                </gc-list-row>
                                {/* @ts-ignore */}
                                <gc-list-row selected>
                                    <span style={{ flex: 1 }}>Default gold accent</span>
                                {/* @ts-ignore */}
                                </gc-list-row>
                                {/* @ts-ignore */}
                            </gc-panel>
                        </SectionCard>

                        <SectionCard title="Interactive (server browser)">
                            <div ref={containerRef}>
                                {/* @ts-ignore */}
                                <gc-panel bordered>
                                    {servers.map(s => (
                                        // @ts-ignore
                                        <gc-list-row
                                            key={s.id}
                                            data-id={s.id}
                                            {...(s.id === selected ? { selected: true } : {})}
                                        >
                                            <span style={{ flex: 1 }}>{s.name}</span>
                                            <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-parch-3)' }}>{s.region}</span>
                                            {/* @ts-ignore */}
                                            <gc-ping-display ping={s.ping} />
                                            {/* @ts-ignore */}
                                        </gc-list-row>
                                    ))}
                                    {/* @ts-ignore */}
                                </gc-panel>
                            </div>
                            <div className="mt-3" style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>
                                selected: {selected}
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ListRowDemo
