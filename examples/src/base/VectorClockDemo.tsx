import { useState } from 'react'
import { VectorClock } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const clockA = new VectorClock('node-A')
const clockB = new VectorClock('node-B')

clockA.increment()
clockA.increment()
clockB.increment()

console.log('Concurrent?', clockA.isConcurrent(clockB)) // true

clockA.update(clockB) // merge
console.log('A isAfter B?', clockA.isAfter(clockB))      // true`

export const VectorClockDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const clockA = new VectorClock('node-A')
        const clockB = new VectorClock('node-B')

        clockA.increment()
        clockA.increment()
        console.log('A after 2 increments:', JSON.stringify(clockA.getClock()))

        clockB.increment()
        console.log('B after 1 increment:', JSON.stringify(clockB.getClock()))

        console.log('A isAfter B?', clockA.isAfter(clockB))
        console.log('A isBefore B?', clockA.isBefore(clockB))
        console.log('Concurrent?', clockA.isConcurrent(clockB))

        clockA.update(clockB)
        console.log('A after merge with B:', JSON.stringify(clockA.getClock()))
        console.log('A isAfter B now?', clockA.isAfter(clockB))
    }))
    return (
        <DemoSection
            title="VectorClock"
            description="Vector clock for causal ordering in distributed systems. Tracks versions per node and detects concurrency."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default VectorClockDemo
