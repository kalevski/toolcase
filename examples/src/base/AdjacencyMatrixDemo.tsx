import { useState } from 'react'
import { AdjacencyMatrix } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const graph = new AdjacencyMatrix()
graph.addVertex('A')
graph.addVertex('B')
graph.addVertex('C')

graph.addEdge('A', 'B')
graph.addEdge('A', 'C')

console.log(graph.getEdges('A'))  // ['B', 'C']
console.log(graph.hasEdge('B', 'A')) // false (directed)

graph.removeVertex('C')`

export const AdjacencyMatrixDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const graph = new AdjacencyMatrix()
        graph.addVertex('A')
        graph.addVertex('B')
        graph.addVertex('C')
        graph.addVertex('D')

        graph.addEdge('A', 'B')
        graph.addEdge('A', 'C')
        graph.addEdge('B', 'D')
        graph.addEdge('C', 'D')

        console.log('Vertices:', JSON.stringify(graph.vertices))
        console.log('Edges from A:', JSON.stringify(graph.getEdges('A')))
        console.log('Edges from B:', JSON.stringify(graph.getEdges('B')))
        console.log('A→B exists?', graph.hasEdge('A', 'B'))
        console.log('B→A exists?', graph.hasEdge('B', 'A'))

        graph.removeEdge('A', 'B')
        console.log('After removing A→B:', JSON.stringify(graph.getEdges('A')))

        graph.removeVertex('D')
        console.log('After removing D, vertices:', JSON.stringify(graph.vertices))
    }))
    return (
        <DemoSection
            title="AdjacencyMatrix"
            description="Directed graph using an adjacency matrix. Supports weighted edges via generic types."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default AdjacencyMatrixDemo
