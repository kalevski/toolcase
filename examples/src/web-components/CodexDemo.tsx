import React, { useState } from 'react'
import { useTc } from '@toolcase/web-components/react'

const ENTRIES = [
    {
        id: 'gloomfang',
        name: 'Gloomfang',
        icon: 'skull',
        discovered: true,
        description:
            'A pack hunter that stalks the lower caverns, striking from darkness before retreating.',
        stats: [
            { label: 'Threat', value: 'High' },
            { label: 'Health', value: 2400 },
            { label: 'Encounters', value: 17 },
        ],
    },
    {
        id: 'emberwisp',
        name: 'Emberwisp',
        icon: 'flame',
        discovered: true,
        description: 'A drifting mote of living fire. Harmless alone, deadly in swarms.',
        stats: [
            { label: 'Threat', value: 'Low' },
            { label: 'Health', value: 90 },
            { label: 'Encounters', value: 132 },
        ],
    },
    {
        id: 'tidecaller',
        name: 'Tidecaller',
        icon: 'waves',
        discovered: true,
        description: 'Ancient leviathan that commands the coastal storms.',
        stats: [
            { label: 'Threat', value: 'Boss' },
            { label: 'Health', value: 18000 },
            { label: 'Encounters', value: 2 },
        ],
    },
    { id: 'unknown-1', name: 'Unknown', discovered: false },
    { id: 'unknown-2', name: 'Unknown', discovered: false },
]

const CodexDemo: React.FC = () => {
    const [selected, setSelected] = useState<string>('gloomfang')
    const ref = useTc<HTMLElement>(
        { entries: ENTRIES },
        { 'tc-select': (e: Event) => setSelected((e as CustomEvent<{ id: string }>).detail.id) }
    )

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Codex"
                            description="Codex / bestiary browser: a scrollable list of entries paired with a detail panel showing the active entry's description and stats. Entries are supplied via the `entries` JS property; the selection is reflected on the `selected-id` attribute. Emits tc-select on click / Enter / Space. Undiscovered entries render masked (??? + a muted glyph) but stay selectable."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Bestiary (data-driven list + detail panel)">
                                {/* @ts-ignore */}
                                <tc-codex ref={ref} selected-id="gloomfang" />
                                <div className="form-text mt-3">
                                    Selected: <code>{selected}</code>
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CodexDemo
