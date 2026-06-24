import { useState } from 'react'
import { Spatial } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `// --- SpatialHash ---
const hash = new Spatial.SpatialHash(64)

hash.insert('player', { x: 100, y: 100, width: 32, height: 32 })
hash.insert('enemy1', { x: 140, y: 110, width: 32, height: 32 })
hash.insert('enemy2', { x: 500, y: 500, width: 32, height: 32 })
console.log('size:', hash.size) // 3

// Range query
const nearby = hash.query({ x: 80, y: 80, width: 120, height: 120 })
console.log('nearby player:', nearby) // ['player', 'enemy1']

// Nearest neighbour
console.log('nearest to origin:', hash.nearest({ x: 0, y: 0 })) // 'player'

// Move player
hash.update('player', { x: 480, y: 480, width: 32, height: 32 })
console.log('nearest to origin after move:', hash.nearest({ x: 0, y: 0 })) // 'enemy1'

// --- Quadtree ---
const qt = new Spatial.Quadtree({ x: 0, y: 0, width: 1024, height: 1024 }, 2, 6)

qt.insert('A', { x: 10, y: 10, width: 20, height: 20 })
qt.insert('B', { x: 500, y: 500, width: 20, height: 20 })
qt.insert('C', { x: 15, y: 15, width: 10, height: 10 })
console.log('qt size:', qt.size)

const found = qt.query({ x: 0, y: 0, width: 100, height: 100 })
console.log('qt query [0,0,100,100]:', found) // ['A', 'C']

console.log('qt nearest to origin:', qt.nearest({ x: 0, y: 0 })) // 'A'

qt.remove('A')
console.log('qt nearest after remove A:', qt.nearest({ x: 0, y: 0 })) // 'C'`

export const SpatialDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        // SpatialHash
        const hash = new Spatial.SpatialHash<string>(64)

        hash.insert('player', { x: 100, y: 100, width: 32, height: 32 })
        hash.insert('enemy1', { x: 140, y: 110, width: 32, height: 32 })
        hash.insert('enemy2', { x: 500, y: 500, width: 32, height: 32 })
        console.log('size:', hash.size)

        const nearby = hash.query({ x: 80, y: 80, width: 120, height: 120 })
        console.log('nearby player:', JSON.stringify(nearby.sort()))

        console.log('nearest to origin:', hash.nearest({ x: 0, y: 0 }))

        hash.update('player', { x: 480, y: 480, width: 32, height: 32 })
        console.log('nearest to origin after move:', hash.nearest({ x: 0, y: 0 }))

        // Quadtree
        const qt = new Spatial.Quadtree<string>({ x: 0, y: 0, width: 1024, height: 1024 }, 2, 6)

        qt.insert('A', { x: 10, y: 10, width: 20, height: 20 })
        qt.insert('B', { x: 500, y: 500, width: 20, height: 20 })
        qt.insert('C', { x: 15, y: 15, width: 10, height: 10 })
        console.log('qt size:', qt.size)

        const found = qt.query({ x: 0, y: 0, width: 100, height: 100 })
        console.log('qt query [0,0,100,100]:', JSON.stringify(found.sort()))

        console.log('qt nearest to origin:', qt.nearest({ x: 0, y: 0 }))

        qt.remove('A')
        console.log('qt nearest after remove A:', qt.nearest({ x: 0, y: 0 }))

        console.log('nearest with maxDist=5 (nothing close):', qt.nearest({ x: 0, y: 0 }, 5))
    }))
    return (
        <DemoSection
            title="Spatial (SpatialHash + Quadtree)"
            description="Broad-phase 2D spatial partitioning. SpatialHash uses a uniform grid for O(1) amortised insert/remove. Quadtree uses recursive subdivision for uneven density. Both support range queries and nearest-neighbour lookup."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default SpatialDemo
