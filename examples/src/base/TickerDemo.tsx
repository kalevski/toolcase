import { useState } from 'react'
import { Ticker } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `// variable-step: callback receives the actual delta each tick
const varTicker = new Ticker()
varTicker.onTick((delta, elapsed) => { /* ... */ })
varTicker.start()
varTicker.tick(16)   // fires once: delta=16, elapsed=16
varTicker.tick(33)   // fires once: delta=33, elapsed=49

// fixed-step (step=10ms): accumulates and fires per complete step
const fixedTicker = new Ticker(10)
fixedTicker.onTick((step) => { /* ... */ })
fixedTicker.start()
fixedTicker.tick(25)  // fires twice (steps 0→10, 10→20); remainder=5`

export const TickerDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        setLogs(captureConsole(() => {
            console.log('--- variable-step ticker ---')
            const varTicker = new Ticker()
            varTicker.onTick((delta, elapsed) => {
                console.log(`  delta=${delta}ms  elapsed=${elapsed}ms`)
            })
            varTicker.start()
            varTicker.tick(16)
            varTicker.tick(33)
            varTicker.tick(17)
            varTicker.stop()

            console.log('--- fixed-step ticker (step=10ms) ---')
            const fixedTicker = new Ticker(10)
            let fires = 0
            fixedTicker.onTick((step) => {
                fires++
                console.log(`  step fired #${fires}: ${step}ms`)
            })
            fixedTicker.start()
            fixedTicker.tick(25)
            console.log(`  elapsed: ${fixedTicker.elapsed}ms  fires: ${fires}`)
            fixedTicker.tick(8)
            console.log(`  elapsed: ${fixedTicker.elapsed}ms  fires: ${fires}`)
        }))
    }
    return (
        <DemoSection
            title="Ticker"
            description="Fixed-step or variable-step update dispatcher. Drive it by calling tick(delta) from your animation or game loop. In fixed-step mode it accumulates remainders and fires once per complete step interval."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default TickerDemo
