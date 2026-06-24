import { useState } from 'react'
import { Stopwatch } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `let t = 0
const sw = new Stopwatch(() => t)

sw.start()
t = 100
sw.lap()         // records 100ms, resets lap start
t = 250
sw.lap()         // records 150ms
sw.stop()
t = 999          // clock advances — elapsed stays frozen
console.log(sw.elapsed)   // 250
console.log(sw.laps)      // [100, 150]`

export const StopwatchDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        setLogs(captureConsole(() => {
            let t = 0
            const sw = new Stopwatch(() => t)

            sw.start()
            t = 100
            console.log(`running: ${sw.running}`)
            console.log(`elapsed: ${sw.elapsed}ms`)

            const l1 = sw.lap()
            console.log(`lap 1: ${l1}ms`)

            t = 250
            const l2 = sw.lap()
            console.log(`lap 2: ${l2}ms`)

            sw.stop()
            t = 999
            console.log(`--- stopped (clock at 999) ---`)
            console.log(`elapsed after stop: ${sw.elapsed}ms (unchanged)`)
            console.log(`running: ${sw.running}`)
            console.log(`laps: [${sw.laps.join(', ')}]`)

            sw.reset()
            console.log(`--- reset ---`)
            console.log(`elapsed: ${sw.elapsed}ms`)
        }))
    }
    return (
        <DemoSection
            title="Stopwatch"
            description="Elapsed-time tracker with start/stop/lap. Paused intervals do not count towards elapsed. Inject a clock function (now) for deterministic testing."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default StopwatchDemo
