import React, { useEffect, useRef, useState } from 'react'

type Pos = { x: number; y: number }

const GRAPH = {
    nodes: [
        { id: 'src', label: 'Source', outputs: [{ id: 'out', label: 'data' }] },
        {
            id: 'filter',
            label: 'Filter',
            inputs: [{ id: 'in', label: 'in' }],
            outputs: [
                { id: 'ok', label: 'pass' },
                { id: 'rej', label: 'reject' },
            ],
        },
        { id: 'sink', label: 'Sink', inputs: [{ id: 'in', label: 'in' }] },
    ],
    edges: [
        { from: 'src', to: 'filter', fromPort: 'out', toPort: 'in' },
        { from: 'filter', to: 'sink', fromPort: 'ok', toPort: 'in' },
    ],
}

const INITIAL_POSITIONS: Record<string, Pos> = {
    src: { x: 40, y: 60 },
    filter: { x: 280, y: 120 },
    sink: { x: 540, y: 80 },
}

const NodeEditorDemo: React.FC = () => {
    const ref = useRef<any>(null)
    const [selected, setSelected] = useState<string | null>(null)
    const [positions, setPositions] = useState<Record<string, Pos>>(INITIAL_POSITIONS)
    const [log, setLog] = useState<string>(
        'Drag a node by its header, drag from a "pass"/"reject" port to an input, or scroll to zoom.',
    )

    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.graph = GRAPH
        el.positions = INITIAL_POSITIONS

        const onSelect = (e: Event) => {
            const id = (e as CustomEvent).detail.id as string | null
            setSelected(id)
        }
        const onMove = (e: Event) => {
            const { id, pos } = (e as CustomEvent).detail as { id: string; pos: Pos }
            // Reflect the move back into the controlled positions map.
            setPositions((prev) => {
                const next = { ...prev, [id]: pos }
                el.positions = next
                return next
            })
            setLog(`Moved "${id}" → (${pos.x}, ${pos.y})`)
        }
        const onConnect = (e: Event) => {
            const { from, to } = (e as CustomEvent).detail as { from: string; to: string }
            setLog(`Connected "${from}" → "${to}"`)
        }

        el.addEventListener('tc-select', onSelect)
        el.addEventListener('tc-move-node', onMove)
        el.addEventListener('tc-connect', onConnect)
        return () => {
            el.removeEventListener('tc-select', onSelect)
            el.removeEventListener('tc-move-node', onMove)
            el.removeEventListener('tc-connect', onConnect)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Node Editor"
                            description="Canvas-based visual node/graph editor with drag, pan, zoom, and connection creation."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Interactive graph">
                                {/* @ts-ignore */}
                                <tc-node-editor ref={ref} selected-id={selected ?? undefined} />
                                <div className="form-text mt-2">
                                    <strong>Selected:</strong> {selected ?? '—'} &nbsp;·&nbsp; {log}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <DisabledNodeEditor />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const DisabledNodeEditor: React.FC = () => {
    const ref = useRef<any>(null)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.graph = GRAPH
        el.positions = INITIAL_POSITIONS
    }, [])
    // @ts-ignore
    return <tc-node-editor ref={ref} disabled selected-id="filter" />
}

export default NodeEditorDemo
