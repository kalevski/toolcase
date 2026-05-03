import { useState } from 'react'
import { Cache } from '@toolcase/base'
import { captureConsoleAsync, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const cache = new Cache((key) => {
  console.log('fetchFn called for', key)
  return \`data-for-\${key}\`
}, 2000) // 2s TTL

await cache.get('users')  // calls fetchFn
await cache.get('users')  // cached — no fetch
cache.invalidate('users')
await cache.get('users')  // fetches again`

export const CacheDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [running, setRunning] = useState(false)
    const run = async () => {
        setRunning(true); setLogs([])
        await captureConsoleAsync(async () => {
            let fetchCount = 0
            const cache = new Cache((key: string) => {
                fetchCount++
                console.log(`fetchFn called (#${fetchCount}) for key="${key}"`)
                return `data-for-${key}`
            }, 2000)

            const r1 = await cache.get('users')
            console.log('1st get:', r1)
            const r2 = await cache.get('users')
            console.log('2nd get (cached):', r2)
            console.log('Total fetches:', fetchCount)

            cache.invalidate('users')
            console.log('After invalidate, fetching again...')
            await cache.get('users')
            console.log('Total fetches:', fetchCount)
        }, setLogs)
        setRunning(false)
    }
    return (
        <DemoSection
            title="Cache"
            description="TTL-based cache that deduplicates expensive fetch calls. Re-fetches automatically when entries expire."
            code={code}
            onRun={run}
            logs={logs}
            running={running}
        />
    )
}

export default CacheDemo
