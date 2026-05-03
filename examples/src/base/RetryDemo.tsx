import { useState } from 'react'
import { retry } from '@toolcase/base'
import { captureConsoleAsync, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const result = await retry(() => {
  // throws on first 2 attempts, succeeds on 3rd
  if (attempt < 3) throw new Error('API unavailable')
  return { data: 'success' }
}, {
  retries: 5,
  minTimeout: 300,  // ms
  factor: 2,        // exponential multiplier
  randomize: false
})`

export const RetryDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [running, setRunning] = useState(false)
    const run = async () => {
        setRunning(true); setLogs([])
        await captureConsoleAsync(async () => {
            let attempt = 0
            try {
                const result = await retry(() => {
                    attempt++
                    console.log(`Attempt #${attempt}...`)
                    if (attempt < 3) throw new Error('API unavailable')
                    return { data: 'success', attempt }
                }, { retries: 5, minTimeout: 300, factor: 2, randomize: false })
                console.log('Result:', JSON.stringify(result))
            } catch (err) {
                console.log('Failed:', String(err))
            }
        }, setLogs)
        setRunning(false)
    }
    return (
        <DemoSection
            title="retry"
            description="Retry an async function with exponential backoff. Configurable retries, timeouts, and jitter."
            code={code}
            onRun={run}
            logs={logs}
            running={running}
        />
    )
}

export default RetryDemo
