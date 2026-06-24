import { useMemo, useState } from 'react'
import { Random } from '@toolcase/base'

const code = `import { Random } from '@toolcase/base'

const rng = new Random(42)

rng.next()                    // float in [0, 1)
rng.int(1, 6)                 // dice roll
rng.float(0.5, 2.5)          // float in range
rng.bool(0.3)                 // true ~30%
rng.pick(['🗡️', '🛡️', '🏹']) // random pick
rng.shuffle([1, 2, 3, 4, 5]) // new shuffled array
rng.weighted([
    { item: 'common', weight: 7 },
    { item: 'rare',   weight: 3 }
])                            // weighted draw

// Same seed → same sequence
const a = new Random(99)
const b = new Random(99)
a.next() === b.next()         // true

// Injectable into WeightedRandom
import { WeightedRandom } from '@toolcase/base'
const loot = new WeightedRandom(entries, e => e.weight, () => rng.next())`

const ITEMS = ['🗡️ Sword', '🛡️ Shield', '🏹 Bow', '🔮 Orb', '💍 Ring']
const LOOT = [
    { item: 'Common',    weight: 50, color: '#94a3b8' },
    { item: 'Uncommon',  weight: 30, color: '#34d399' },
    { item: 'Rare',      weight: 14, color: '#60a5fa' },
    { item: 'Epic',      weight: 5,  color: '#a78bfa' },
    { item: 'Legendary', weight: 1,  color: '#fbbf24' },
]

export const RandomDemo = () => {
    const [seed, setSeed] = useState(42)
    const [seedInput, setSeedInput] = useState('42')
    const [drawCount, setDrawCount] = useState(1000)
    const [tick, setTick] = useState(0)

    const result = useMemo(() => {
        const rng = new Random(seed + tick * 0)
        const nextVals = Array.from({ length: 8 }, () => rng.next().toFixed(6))
        const dice = Array.from({ length: 10 }, () => rng.int(1, 6))
        const picked = Array.from({ length: 5 }, () => rng.pick(ITEMS))
        const shuffled = rng.shuffle(ITEMS)

        const rng2 = new Random(seed)
        const counts = new Map<string, number>(LOOT.map((e) => [e.item, 0]))
        for (let i = 0; i < drawCount; i++) {
            const w = rng2.weighted(LOOT.map((e) => ({ item: e.item, weight: e.weight })))
            counts.set(w, (counts.get(w) ?? 0) + 1)
        }

        const rngA = new Random(seed)
        const rngB = new Random(seed)
        const repro = Array.from({ length: 6 }, () => [rngA.next().toFixed(4), rngB.next().toFixed(4)])
        const allMatch = repro.every(([a, b]) => a === b)

        return { nextVals, dice, picked, shuffled, counts, repro, allMatch }
    }, [seed, drawCount, tick])

    const applyInput = () => {
        const n = parseInt(seedInput, 10)
        if (!Number.isNaN(n)) setSeed(n)
    }

    return (
        <div className="card">
            <div className="card-body">
                <h3 className="card-title">Random</h3>
                <p className="text-body-secondary">
                    Seedable mulberry32 PRNG. Identical seeds produce identical sequences — enabling
                    deterministic games, reproducible tests, and seeded procedural content.
                </p>
                <tc-code-snippet code={code.trim()} language="typescript"></tc-code-snippet>

                <div className="row g-3 mt-2">
                    <div className="col-sm-6 col-lg-4">
                        <label className="form-label" htmlFor="rng-seed">Seed</label>
                        <div className="input-group input-group-sm">
                            <input
                                id="rng-seed"
                                type="number"
                                className="form-control"
                                value={seedInput}
                                onChange={(e) => setSeedInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyInput()}
                            />
                            <button className="btn btn-primary" onClick={applyInput}>Apply</button>
                        </div>
                    </div>
                    <div className="col-sm-6 col-lg-4">
                        <label className="form-label" htmlFor="rng-draws">Weighted draws</label>
                        <select
                            id="rng-draws"
                            className="form-select form-select-sm"
                            value={String(drawCount)}
                            onChange={(e) => setDrawCount(Number(e.target.value))}
                        >
                            <option value="200">200</option>
                            <option value="1000">1,000</option>
                            <option value="10000">10,000</option>
                        </select>
                    </div>
                    <div className="col-sm-12 col-lg-4 d-flex align-items-end">
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => { setSeed(Math.floor(Math.random() * 999999)); setSeedInput(String(Math.floor(Math.random() * 999999))) }}
                        >
                            Random seed
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>

                    <div style={{ padding: 12, background: '#0f172a', color: '#e2e8f0', fontFamily: 'Ubuntu Mono, monospace', fontSize: 13 }}>
                        <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                            next() — 8 values from seed {seed}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {result.nextVals.map((v, i) => (
                                <span key={i} style={{ color: '#7dd3fc' }}>{v}</span>
                            ))}
                        </div>
                    </div>

                    <div style={{ padding: 12, background: '#0f172a', color: '#e2e8f0', fontFamily: 'Ubuntu Mono, monospace', fontSize: 13 }}>
                        <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                            int(1, 6) — dice rolls
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {result.dice.map((v, i) => (
                                <span key={i} style={{ color: '#fbbf24', minWidth: 16, textAlign: 'center' }}>{v}</span>
                            ))}
                        </div>
                    </div>

                    <div style={{ padding: 12, background: '#0f172a', color: '#e2e8f0', fontFamily: 'Ubuntu Mono, monospace', fontSize: 13 }}>
                        <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                            pick() + shuffle()
                        </div>
                        <div style={{ marginBottom: 6 }}>
                            <span style={{ color: '#64748b' }}>pick ×5: </span>
                            {result.picked.map((v, i) => <span key={i} style={{ marginRight: 8 }}>{v}</span>)}
                        </div>
                        <div>
                            <span style={{ color: '#64748b' }}>shuffle: </span>
                            {result.shuffled.map((v, i) => <span key={i} style={{ marginRight: 8 }}>{v}</span>)}
                        </div>
                    </div>

                    <div style={{ padding: 12, background: '#0f172a', color: '#e2e8f0', fontFamily: 'Ubuntu Mono, monospace', fontSize: 13 }}>
                        <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                            weighted() — {drawCount.toLocaleString()} draws
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {LOOT.map((tier) => {
                                const count = result.counts.get(tier.item) ?? 0
                                const actual = count / drawCount
                                const expected = tier.weight / LOOT.reduce((s, e) => s + e.weight, 0)
                                return (
                                    <div key={tier.item} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 80px', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: tier.color }}>{tier.item}</span>
                                        <div style={{ position: 'relative', height: 16, background: '#020617', border: '1px solid #1e2a44' }}>
                                            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${Math.max(1, actual * 100)}%`, background: tier.color, opacity: 0.8 }} />
                                            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.max(1, expected * 100)}%`, width: 1, background: '#f8fafc' }} />
                                        </div>
                                        <span style={{ textAlign: 'right' }}>{(actual * 100).toFixed(1)}%</span>
                                        <span style={{ color: '#64748b', textAlign: 'right' }}>exp {(expected * 100).toFixed(0)}%</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div style={{ padding: 12, background: '#0f172a', color: '#e2e8f0', fontFamily: 'Ubuntu Mono, monospace', fontSize: 13 }}>
                        <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                            Reproducibility — two instances, same seed {seed}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {result.repro.map(([a, b], i) => (
                                <div key={i} style={{ display: 'flex', gap: 16 }}>
                                    <span style={{ color: '#7dd3fc' }}>rngA: {a}</span>
                                    <span style={{ color: '#86efac' }}>rngB: {b}</span>
                                    <span style={{ color: a === b ? '#4ade80' : '#f87171' }}>{a === b ? '✓ match' : '✗ mismatch'}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 8, color: result.allMatch ? '#4ade80' : '#f87171', fontSize: 12 }}>
                            {result.allMatch ? 'All 6 values match — seed is deterministic' : 'Mismatch detected'}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default RandomDemo
