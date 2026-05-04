import { useState } from 'react'
import { AStar } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `import { AStar } from '@toolcase/base'

type Cell = { x: number, y: number }
const SIZE = 6
const blocked = new Set(['2,1', '2,2', '2,3', '2,4'])
const inBounds = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < SIZE && c.y < SIZE
const free = (c: Cell) => inBounds(c) && !blocked.has(\`\${c.x},\${c.y}\`)

const search = new AStar({ x: 0, y: 0 }, { x: 5, y: 5 }, {
  neighbors: (n) => [
    { x: n.x + 1, y: n.y }, { x: n.x - 1, y: n.y },
    { x: n.x, y: n.y + 1 }, { x: n.x, y: n.y - 1 }
  ].filter(free),
  cost: () => 1,
  heuristic: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
  hash: (n) => \`\${n.x},\${n.y}\`
})

const visited = new Set<string>()
search.on(AStar.VISIT, (n) => visited.add(\`\${n.x},\${n.y}\`))
search.on(AStar.FOUND, (r) => console.log('found', r.cost))

// Cooperative: 2 expansions per "frame"
while (!search.isComplete) search.run(2)`

export const AStarDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        type Cell = { x: number, y: number }
        const SIZE = 6
        const inBounds = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < SIZE && c.y < SIZE
        const blocked = new Set(['2,1', '2,2', '2,3', '2,4'])
        const free = (c: Cell) => inBounds(c) && !blocked.has(`${c.x},${c.y}`)

        const search = new AStar({ x: 0, y: 0 }, { x: 5, y: 5 }, {
            neighbors: (n) => [
                { x: n.x + 1, y: n.y },
                { x: n.x - 1, y: n.y },
                { x: n.x, y: n.y + 1 },
                { x: n.x, y: n.y - 1 }
            ].filter(free),
            cost: () => 1,
            heuristic: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
            hash: (n) => `${n.x},${n.y}`
        })

        const visited = new Set<string>()
        search.on(AStar.VISIT, (n: Cell) => visited.add(`${n.x},${n.y}`))
        search.on(AStar.FOUND, (r: { path: Cell[], cost: number }) => {
            console.log(`FOUND in ${search.iterations} iterations, cost=${r.cost}`)
        })

        let frame = 0
        while (!search.isComplete) {
            frame++
            search.run(2)
            console.log(`frame ${frame}: visited=${visited.size}, status=${search.getStatus()}`)
        }

        const path = search.getResult()!
        const onPath = new Set(path.path.map(c => `${c.x},${c.y}`))

        const grid: string[] = []
        for (let y = 0; y < SIZE; y++) {
            let row = ''
            for (let x = 0; x < SIZE; x++) {
                const k = `${x},${y}`
                if (blocked.has(k)) row += '# '
                else if (k === '0,0') row += 'S '
                else if (k === '5,5') row += 'E '
                else if (onPath.has(k)) row += '· '
                else if (visited.has(k)) row += 'x '
                else row += '. '
            }
            grid.push(row)
        }
        console.log('\nMap (S=start, E=end, #=wall, x=visited, ·=path):')
        for (const row of grid) console.log(row)
    }))
    return (
        <DemoSection
            title="AStar"
            description="A* extends Dijkstra. Same step()/event API, plus a heuristic. Demo runs 2 expansions per frame to mimic a per-tick budget."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default AStarDemo
