import { useEffect, useMemo, useState } from 'react'
import { Packing } from '@toolcase/base'
import type {
    PackingAlgorithmKind as AlgorithmKind,
    PackingResult as PackResult,
    PackingSprite as Sprite,
    PackingSortStrategy as SortStrategy,
} from '@toolcase/base'

const code = `import { Packing } from '@toolcase/base'

const packer = new Packing.Packer({
    algorithm: 'max-rects',
    maxWidth: 512,
    maxHeight: 512,
    allowRotation: true,
    padding: 2,
    extrude: 0,
    pot: 'none',
    sort: 'area-desc',
    trim: false,
    alphaThreshold: 0,
    budget: {}
})

const sprites = [
    { id: 'a', width: 64, height: 32 },
    { id: 'b', width: 48, height: 48 },
    // ...
]

const result = packer.pack(sprites)
// result.pages[i].sprites -> [{ id, rect, rotated, ... }]
// result.pages[i].occupancy -> 0..1
// result.unpacked -> sprites that did not fit`

const ALGOS: { value: AlgorithmKind; label: string }[] = [
    { value: 'max-rects', label: 'MaxRects' },
    { value: 'guillotine', label: 'Guillotine' },
    { value: 'shelf', label: 'Shelf' },
    { value: 'skyline', label: 'Skyline' },
    { value: 'binary-tree', label: 'BinaryTree' },
]

const SORTS: { value: SortStrategy | 'none'; label: string }[] = [
    { value: 'area-desc', label: 'area desc' },
    { value: 'max-side-desc', label: 'max-side desc' },
    { value: 'height-desc', label: 'height desc' },
    { value: 'width-desc', label: 'width desc' },
    { value: 'perimeter-desc', label: 'perimeter desc' },
    { value: 'none', label: 'none' },
]

const PAGE_SIZE = 512

const mulberry = (seed: number) => {
    let s = seed >>> 0
    return () => {
        s = (s + 0x6D2B79F5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const generateSprites = (seed: number, count: number): Sprite[] => {
    const rng = mulberry(seed)
    const sprites: Sprite[] = []
    for (let i = 0; i < count; i++) {
        const r = rng()
        let width: number
        let height: number
        if (r < 0.15) {
            width = Math.floor(rng() * 96) + 96
            height = Math.floor(rng() * 96) + 96
        } else if (r < 0.55) {
            width = Math.floor(rng() * 64) + 32
            height = Math.floor(rng() * 64) + 32
        } else {
            width = Math.floor(rng() * 28) + 12
            height = Math.floor(rng() * 28) + 12
        }
        sprites.push({ id: `s${i}`, width, height })
    }
    return sprites
}

const colorFor = (id: string) => {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
    const hue = ((h % 360) + 360) % 360
    return `hsl(${hue} 70% 55%)`
}

export const PackingDemo = () => {
    const [algorithm, setAlgorithm] = useState<AlgorithmKind>('max-rects')
    const [sort, setSort] = useState<SortStrategy | 'none'>('area-desc')
    const [allowRotation, setAllowRotation] = useState(true)
    const [count, setCount] = useState(60)
    const [seed, setSeed] = useState(1)
    const [result, setResult] = useState<PackResult | null>(null)
    const [elapsed, setElapsed] = useState(0)

    const sprites = useMemo(() => generateSprites(seed, count), [seed, count])

    const pack = () => {
        const packer = new Packing.Packer({
            algorithm,
            sort,
            trim: false,
            alphaThreshold: 0,
            allowRotation,
            maxWidth: PAGE_SIZE,
            maxHeight: PAGE_SIZE,
            padding: 2,
            extrude: 0,
            pot: 'none',
            budget: {},
        })
        const t0 = performance.now()
        const r = packer.pack(sprites)
        const t1 = performance.now()
        setElapsed(t1 - t0)
        setResult(r)
    }

    useEffect(() => {
        pack()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [algorithm, sort, allowRotation, sprites])

    const totalSprites = sprites.length
    const placed = result?.pages.reduce((sum, p) => sum + p.sprites.length, 0) ?? 0
    const unpacked = result?.unpacked.length ?? 0
    const avgOccupancy = result && result.pages.length > 0
        ? result.pages.reduce((s, p) => s + p.occupancy, 0) / result.pages.length
        : 0

    return (
        <div className="card">
            <div className="card-body">
            <h3 className="card-title">Packing</h3>
            <p className="text-body-secondary">
                Bin-packing toolkit — pack 2D rects into atlas pages with five algorithms (MaxRects,
                Guillotine, Shelf, Skyline, BinaryTree). Supports rotation, padding, sort presets,
                multi-page planning, and POT sizing. Useful for sprite atlases and texture packers.
            </p>
            <tc-code-snippet code={code.trim()} language="typescript"></tc-code-snippet>

            <div className="row g-3 mt-2">
                <div className="col-sm-6 col-lg-3">
                    <label className="form-label" htmlFor="packing-algorithm">
                        Algorithm
                    </label>
                    <select
                        id="packing-algorithm"
                        className="form-select form-select-sm"
                        value={algorithm}
                        onChange={(e) => setAlgorithm(e.target.value as AlgorithmKind)}
                    >
                        {ALGOS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-sm-6 col-lg-3">
                    <label className="form-label" htmlFor="packing-sort">
                        Sort
                    </label>
                    <select
                        id="packing-sort"
                        className="form-select form-select-sm"
                        value={sort}
                        onChange={(e) => setSort(e.target.value as SortStrategy | 'none')}
                    >
                        {SORTS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="col-sm-6 col-lg-3">
                    <label className="form-label" htmlFor="packing-count">
                        Sprites
                    </label>
                    <select
                        id="packing-count"
                        className="form-select form-select-sm"
                        value={String(count)}
                        onChange={(e) => setCount(Number(e.target.value))}
                    >
                        <option value="20">20</option>
                        <option value="40">40</option>
                        <option value="60">60</option>
                        <option value="100">100</option>
                        <option value="160">160</option>
                    </select>
                </div>
                <div className="col-sm-6 col-lg-3 d-flex align-items-end gap-2">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setSeed(seed + 1)}>
                        Reseed
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={pack}>
                        Repack
                    </button>
                </div>
            </div>

            <div className="mt-3">
                <div className="form-check">
                    <input
                        className="form-check-input"
                        type="checkbox"
                        id="packing-allow-rotation"
                        checked={allowRotation}
                        onChange={(e) => setAllowRotation(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="packing-allow-rotation">
                        Allow rotation
                    </label>
                </div>
            </div>

            <div className="row g-2 mt-3">
                <div className="col-sm-3"><Stat label="Pages" value={String(result?.pages.length ?? 0)} /></div>
                <div className="col-sm-3"><Stat label="Placed" value={`${placed} / ${totalSprites}`} /></div>
                <div className="col-sm-3"><Stat label="Unpacked" value={String(unpacked)} /></div>
                <div className="col-sm-3"><Stat label="Avg occupancy" value={`${(avgOccupancy * 100).toFixed(1)}%`} /></div>
                <div className="col-sm-3"><Stat label="Pack time" value={`${elapsed.toFixed(2)} ms`} /></div>
            </div>

            <div className="mt-3 d-flex flex-wrap gap-3">
                {result?.pages.map((page, i) => (
                    <PageView key={i} index={i} width={page.width} height={page.height} occupancy={page.occupancy} sprites={page.sprites} />
                ))}
            </div>
            </div>
        </div>
    )
}

const Stat = ({ label, value }: { label: string; value: string }) => (
    <div style={{ padding: '8px 12px', background: '#0f172a', color: '#e2e8f0', fontFamily: 'Ubuntu Mono, monospace', fontSize: 13 }}>
        <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div>{value}</div>
    </div>
)

type PageViewProps = {
    index: number
    width: number
    height: number
    occupancy: number
    sprites: PackResult['pages'][number]['sprites']
}

const PageView = ({ index, width, height, occupancy, sprites }: PageViewProps) => {
    const display = 320
    const scale = display / Math.max(width, height)
    return (
        <div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontFamily: 'Ubuntu Mono, monospace' }}>
                page {index} — {width}×{height} — {(occupancy * 100).toFixed(1)}%
            </div>
            <svg
                width={width * scale}
                height={height * scale}
                viewBox={`0 0 ${width} ${height}`}
                style={{ background: '#020617', border: '1px solid #1e2a44', display: 'block' }}
            >
                {sprites.map((sprite) => {
                    const fill = colorFor(sprite.id)
                    const { x, y, width: w, height: h } = sprite.rect
                    const fontSize = Math.max(8, Math.min(w, h) * 0.35)
                    return (
                        <g key={sprite.id}>
                            <rect
                                x={x}
                                y={y}
                                width={w}
                                height={h}
                                fill={fill}
                                fillOpacity={0.85}
                                stroke="#020617"
                                strokeWidth={1}
                            />
                            {sprite.rotated && (
                                <line
                                    x1={x}
                                    y1={y}
                                    x2={x + w}
                                    y2={y + h}
                                    stroke="#020617"
                                    strokeOpacity={0.4}
                                    strokeWidth={1}
                                />
                            )}
                            {w >= 24 && h >= 16 && (
                                <text
                                    x={x + w / 2}
                                    y={y + h / 2}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={fontSize}
                                    fill="#020617"
                                    fontFamily="Ubuntu Mono, monospace"
                                >
                                    {sprite.id}
                                </text>
                            )}
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

export default PackingDemo
