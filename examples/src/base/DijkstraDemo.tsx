import { useState } from 'react'
import { Dijkstra } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `import { Dijkstra } from '@toolcase/base'

const edges = {
  A: [['B', 1], ['C', 4]],
  B: [['C', 2], ['D', 5]],
  C: [['D', 1]],
  D: []
}

const search = new Dijkstra('A', 'D', {
  neighbors: (n) => edges[n].map(([t]) => t),
  cost: (from, to) => edges[from].find(([t]) => t === to)[1]
})

search.on(Dijkstra.VISIT, (node, g) => {
  console.log('visit', node, 'g=', g)
})
search.on(Dijkstra.FOUND, (result) => {
  console.log('done', result)
})

while (!search.isComplete) search.step()`

export const DijkstraDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const edges: Record<string, [string, number][]> = {
            A: [['B', 1], ['C', 4]],
            B: [['C', 2], ['D', 5]],
            C: [['D', 1]],
            D: []
        }

        const search = new Dijkstra('A', 'D', {
            neighbors: (n) => (edges[n] ?? []).map(([t]) => t),
            cost: (from, to) => edges[from].find(([t]) => t === to)![1]
        })

        search.on(Dijkstra.VISIT, (node: string, g: number) => {
            console.log(`  step ${search.iterations} visit "${node}" (g=${g})`)
        })
        search.on(Dijkstra.OPEN, (node: string, g: number) => {
            console.log(`    open "${node}" (g=${g})`)
        })
        search.on(Dijkstra.FOUND, (result: { path: string[], cost: number }) => {
            console.log('FOUND:', result.path.join(' → '), 'cost=', result.cost)
        })

        console.log('Manual step loop:')
        while (!search.isComplete) search.step()

        console.log('\nOne-shot via Dijkstra.find():')
        const oneShot = Dijkstra.find('A', 'D', {
            neighbors: (n: string) => (edges[n] ?? []).map(([t]) => t),
            cost: (from: string, to: string) => edges[from].find(([t]) => t === to)![1]
        })
        console.log('Result:', JSON.stringify(oneShot))

        console.log('\nUnreachable D→A:')
        const exhaustive = new Dijkstra('D', 'A', {
            neighbors: (n: string) => (edges[n] ?? []).map(([t]) => t),
            cost: (from: string, to: string) => edges[from].find(([t]) => t === to)![1]
        })
        exhaustive.on(Dijkstra.FAILED, (reason: string) => console.log('FAILED reason:', reason))
        exhaustive.run()
    }))
    return (
        <DemoSection
            title="Dijkstra"
            description="Class-based weighted shortest path. Extends EventEmitter; manual step() for cooperative scheduling; emits VISIT / OPEN / FOUND / FAILED."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default DijkstraDemo
