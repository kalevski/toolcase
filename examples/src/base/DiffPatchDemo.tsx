import { useState } from 'react'
import { diff, patch } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `import { diff, patch } from '@toolcase/base'

const a = { user: 'Alice', score: 10, tags: ['a', 'b'] }
const b = { user: 'Alice', score: 99, tags: ['a', 'b', 'c'], active: true }

const delta = diff(a, b)
// { score: [10, 99], tags: { _t: 'a', _l: 3, '2': ['c'] }, active: [true] }

const result = patch(a, delta)
// { user: 'Alice', score: 99, tags: ['a', 'b', 'c'], active: true }

JSON.stringify(result) === JSON.stringify(b) // true`

export const DiffPatchDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = () => setLogs(captureConsole(() => {
        const a = { user: 'Alice', score: 10, tags: ['a', 'b'] }
        const b = { user: 'Alice', score: 99, tags: ['a', 'b', 'c'], active: true }

        const delta = diff(a, b)
        console.log('── diff ──')
        console.log(JSON.stringify(delta, null, 2))

        const result = patch(a, delta)
        console.log('')
        console.log('── patch(a, delta) ──')
        console.log(JSON.stringify(result))
        console.log('round-trip OK:', JSON.stringify(result) === JSON.stringify(b))

        console.log('')
        console.log('── equal inputs → null delta ──')
        console.log('diff(a, a):', diff(a, a))

        console.log('')
        console.log('── array round-trip ──')
        const x = [1, 2, 3]
        const y = [1, 99, 3, 4]
        const arrDelta = diff(x, y)
        console.log('delta:', JSON.stringify(arrDelta))
        console.log('patched:', JSON.stringify(patch(x, arrDelta)))
    }))

    return (
        <DemoSection
            title="diff / patch"
            description="Compute a structural delta between two plain objects or arrays and apply it. patch(a, diff(a, b)) deep-equals b."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default DiffPatchDemo
