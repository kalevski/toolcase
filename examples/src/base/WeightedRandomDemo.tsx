import { useMemo, useState } from 'react'
import { WeightedRandom } from '@toolcase/base'

const code = `import { WeightedRandom } from '@toolcase/base'

const loot = new WeightedRandom(
    [
        { id: 'common',    weight: 50 },
        { id: 'uncommon',  weight: 30 },
        { id: 'rare',      weight: 14 },
        { id: 'epic',      weight: 5  },
        { id: 'legendary', weight: 1  }
    ],
    (entry) => entry.weight
)

loot.pick().id            // weighted draw
loot.pickMany(1000)       // 1000 independent draws
loot.probabilityOf(e => e.id === 'epic') // 0.05`

type Tier = {
    id: string
    weight: number
    color: string
}

const TIERS: Tier[] = [
    { id: 'common',    weight: 50, color: '#94a3b8' },
    { id: 'uncommon',  weight: 30, color: '#34d399' },
    { id: 'rare',      weight: 14, color: '#60a5fa' },
    { id: 'epic',      weight: 5,  color: '#a78bfa' },
    { id: 'legendary', weight: 1,  color: '#fbbf24' }
]

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

export const WeightedRandomDemo = () => {
    const [draws, setDraws] = useState(1000)
    const [seed, setSeed] = useState(1)
    const [run, setRun] = useState(0)

    const result = useMemo(() => {
        const rng = mulberry(seed + run * 7919)
        const wr = new WeightedRandom<Tier>(TIERS, (t) => t.weight, rng)
        const t0 = performance.now()
        const picks = wr.pickMany(draws)
        const elapsed = performance.now() - t0
        const counts = new Map<string, number>()
        for (const tier of TIERS) counts.set(tier.id, 0)
        for (const pick of picks) counts.set(pick.id, (counts.get(pick.id) ?? 0) + 1)
        const recent = picks.slice(-20).map((p) => p.id)
        return { counts, recent, elapsed, totalWeight: wr.totalWeight }
    }, [draws, seed, run])

    return (
        <div className="card">
            <div className="card-body">
            <h3 className="card-title">WeightedRandom</h3>
            <p className="text-body-secondary">
                Weighted random selection with O(log n) picks. Builds a cumulative-weight table once
                and binary-searches a uniform sample on every <code>pick()</code>. Useful for loot
                tables, weighted spawn pools, A/B traffic splitters, and NPC behavior selection.
            </p>
            <tc-code-snippet code={code.trim()} language="typescript"></tc-code-snippet>

            <div className="row g-3 mt-2">
                <div className="col-sm-6 col-lg-4">
                    <label className="form-label" htmlFor="wr-draws-select">
                        Draws
                    </label>
                    <select
                        id="wr-draws-select"
                        className="form-select form-select-sm"
                        value={String(draws)}
                        onChange={(e) => setDraws(Number(e.target.value))}
                    >
                        <option value="100">100</option>
                        <option value="1000">1,000</option>
                        <option value="10000">10,000</option>
                        <option value="100000">100,000</option>
                    </select>
                </div>
                <div className="col-sm-6 col-lg-8 d-flex align-items-end gap-2">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setSeed(seed + 1)}>
                        Reseed
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRun(run + 1)}>
                        Redraw
                    </button>
                </div>
            </div>

            <div style={{ marginTop: 16, padding: 12, background: '#0f172a', color: '#e2e8f0', fontFamily: 'Ubuntu Mono, monospace', fontSize: 13 }}>
                <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Distribution — {draws.toLocaleString()} draws — {result.elapsed.toFixed(2)} ms
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {TIERS.map((tier) => {
                        const count = result.counts.get(tier.id) ?? 0
                        const expected = tier.weight / result.totalWeight
                        const actual = count / draws
                        const widthPct = Math.max(1, actual * 100)
                        const expPct = Math.max(1, expected * 100)
                        return (
                            <div key={tier.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px 90px', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: tier.color }}>{tier.id}</span>
                                <div style={{ position: 'relative', height: 20, background: '#020617', border: '1px solid #1e2a44' }}>
                                    <div style={{
                                        position: 'absolute',
                                        top: 0, bottom: 0, left: 0,
                                        width: `${widthPct}%`,
                                        background: tier.color,
                                        opacity: 0.85,
                                    }} />
                                    <div style={{
                                        position: 'absolute',
                                        top: 0, bottom: 0,
                                        left: `${expPct}%`,
                                        width: 1,
                                        background: '#f8fafc',
                                    }} />
                                </div>
                                <span style={{ color: '#e2e8f0', textAlign: 'right' }}>
                                    {(actual * 100).toFixed(2)}%
                                </span>
                                <span style={{ color: '#64748b', textAlign: 'right' }}>
                                    exp {(expected * 100).toFixed(0)}%
                                </span>
                            </div>
                        )
                    })}
                </div>
                <div style={{ color: '#64748b', fontSize: 11, marginTop: 12 }}>
                    Filled bar = actual share. Vertical line = expected share.
                </div>
            </div>

            <div style={{ marginTop: 12, padding: 12, background: '#020617', color: '#e2e8f0', fontFamily: 'Ubuntu Mono, monospace', fontSize: 12, border: '1px solid #1e2a44', boxSizing: 'border-box' }}>
                <div style={{ color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                    Last 20 picks
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {result.recent.map((id, i) => {
                        const tier = TIERS.find((t) => t.id === id)!
                        return (
                            <span key={i} style={{ color: tier.color }}>{id}</span>
                        )
                    })}
                </div>
            </div>
            </div>
        </div>
    )
}

export default WeightedRandomDemo
