import React from 'react'

export interface LevelNode {
    id: string
    x: number
    y: number
    label?: React.ReactNode
    icon?: React.ReactNode
    locked?: boolean
    completed?: boolean
    stars?: number
    bestStars?: number
}

export interface LevelEdge {
    from: string
    to: string
}

export interface LevelSelectProps {
    nodes: LevelNode[]
    edges?: LevelEdge[]
    selectedId?: string
    onSelect?: (id: string) => void
    onConfirm?: (id: string) => void
    width?: number
    height?: number
    style?: React.CSSProperties
    className?: string
}

export const LevelSelect: React.FC<LevelSelectProps> = ({ nodes, edges = [], selectedId, onSelect, onConfirm, width = 800, height = 500, style, className }) => {
    const nodeMap = React.useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes])
    return (
        <div className={className} style={{ position: 'relative', width, height, background: '#0d1014', overflow: 'auto', borderRadius: 6, color: '#e6e8ec', ...style }}>
            <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {edges.map((edge, i) => {
                    const a = nodeMap[edge.from], b = nodeMap[edge.to]
                    if (!a || !b) return null
                    const completed = a.completed && b.completed
                    return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={completed ? '#3aa256' : 'rgba(255,255,255,0.2)'} strokeWidth="2" strokeDasharray={completed ? undefined : '4 4'} />
                })}
            </svg>
            {nodes.map((node) => {
                const selected = node.id === selectedId
                return (
                    <button
                        key={node.id}
                        type="button"
                        disabled={node.locked}
                        onClick={() => !node.locked && onSelect?.(node.id)}
                        onDoubleClick={() => !node.locked && onConfirm?.(node.id)}
                        style={{
                            position: 'absolute',
                            left: node.x,
                            top: node.y,
                            transform: 'translate(-50%, -50%)',
                            width: 56,
                            height: 56,
                            borderRadius: '50%',
                            background: node.locked ? '#1a1c20' : node.completed ? '#3aa256' : '#6aa9ff',
                            color: '#fff',
                            border: `3px solid ${selected ? '#ffd35a' : 'rgba(0,0,0,0.6)'}`,
                            cursor: node.locked ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                        }}
                    >
                        {node.locked ? '🔒' : (node.icon ?? node.label)}
                        {(node.bestStars !== undefined || node.stars !== undefined) && (
                            <div style={{ position: 'absolute', bottom: -16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 1, color: '#ffd35a', fontSize: 11 }}>
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <span key={i} style={{ opacity: i < (node.bestStars ?? node.stars ?? 0) ? 1 : 0.25 }}>★</span>
                                ))}
                            </div>
                        )}
                    </button>
                )
            })}
        </div>
    )
}

export const WorldMap = LevelSelect
