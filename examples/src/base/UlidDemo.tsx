import { useState } from 'react'
import { ulid } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `import { ulid } from '@toolcase/base'

// 26-char Crockford Base32: [10 time chars][16 random chars]
ulid() // '01HWPEMZRQ8T3K4J5N6M7P8Q9R'

// Lexicographically sortable — safe as event-log or DB primary key
const a = ulid()
const b = ulid()
a < b   // true (monotonically increasing)

// Rapid-fire generation stays sorted
const ids = Array.from({ length: 1000 }, ulid)
ids.slice().sort() // identical to ids — guaranteed`

export const UlidDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        console.log('── basic ──')
        console.log('ulid():', ulid())
        console.log('ulid():', ulid())
        console.log('ulid():', ulid())

        console.log('')
        console.log('── sortability ──')
        const ids = Array.from({ length: 5 }, () => ulid())
        const sorted = ids.slice().sort()
        console.log('ids:   ', ids.join(', '))
        console.log('sorted:', sorted.join(', '))
        console.log('matches insertion order:', JSON.stringify(ids) === JSON.stringify(sorted))

        console.log('')
        console.log('── monotonicity (1000 rapid-fire) ──')
        const rapid = Array.from({ length: 1000 }, () => ulid())
        let allOrdered = true
        for (let i = 1; i < rapid.length; i++) {
            if (rapid[i - 1] >= rapid[i]) { allOrdered = false; break }
        }
        console.log('all strictly increasing:', allOrdered)
        console.log('first:', rapid[0])
        console.log('last: ', rapid[rapid.length - 1])
    }))
    return (
        <DemoSection
            title="ulid"
            description="Monotonic sortable ID generator. 26-character Crockford Base32 string — 10-char millisecond timestamp + 16-char random suffix. Lexicographic order equals insertion order, guaranteed even under rapid-fire generation within the same millisecond."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default UlidDemo
