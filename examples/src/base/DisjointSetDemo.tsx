import { useState } from 'react'
import { DisjointSet } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const ds = new DisjointSet()

ds.makeSet('a').makeSet('b').makeSet('c').makeSet('d').makeSet('e')
console.log('count:', ds.count) // 5

ds.union('a', 'b')
ds.union('b', 'c')
console.log('count after a-b-c merge:', ds.count) // 3
console.log('a connected to c?', ds.connected('a', 'c')) // true
console.log('a connected to d?', ds.connected('a', 'd')) // false

ds.union('d', 'e')
ds.union('a', 'd')
console.log('count (one group):', ds.count) // 1
console.log('all connected?', ds.connected('b', 'e')) // true`

export const DisjointSetDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const ds = new DisjointSet()

        ds.makeSet('a').makeSet('b').makeSet('c').makeSet('d').makeSet('e')
        console.log('count:', ds.count)

        ds.union('a', 'b')
        ds.union('b', 'c')
        console.log('count after a-b-c merge:', ds.count)
        console.log('a connected to c?', ds.connected('a', 'c'))
        console.log('a connected to d?', ds.connected('a', 'd'))

        ds.union('d', 'e')
        ds.union('a', 'd')
        console.log('count (all merged):', ds.count)
        console.log('b connected to e?', ds.connected('b', 'e'))

        console.log('find root of a:', ds.find('a'))
        console.log('find unknown key:', ds.find('z'))
        console.log('union already-same returns false:', ds.union('a', 'c'))
    }))
    return (
        <DemoSection
            title="DisjointSet"
            description="Union-Find with path compression and union-by-rank. Near-O(1) amortised connected-components queries."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default DisjointSetDemo
