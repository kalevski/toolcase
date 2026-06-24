import { useState } from 'react'
import { TokenBucket } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `// 5 tokens, refills 1 token per ms (using injected clock)
let t = 0
const bucket = new TokenBucket(5, 1, () => t)

bucket.tryRemove(3)  // true  — 2 remaining
bucket.tryRemove(3)  // false — only 2 left

// advance clock by 4 ms
t += 4
bucket.tryRemove(3)  // true  — 2 + 4 = 6, capped at 5, minus 3 = 2 remaining
bucket.take()        // true  — removes 1 (default)
console.log(bucket.tokens)  // ~1`

export const TokenBucketDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        setLogs(captureConsole(() => {
            let t = 0
            const bucket = new TokenBucket(5, 1, () => t)

            console.log(`Bucket capacity: ${bucket.capacity}, refillRate: ${bucket.refillRate}/tick`)
            console.log(`Initial tokens: ${bucket.tokens}`)

            const r1 = bucket.tryRemove(3)
            console.log(`tryRemove(3) → ${r1} | tokens: ${bucket.tokens}`)

            const r2 = bucket.tryRemove(3)
            console.log(`tryRemove(3) → ${r2} | tokens: ${bucket.tokens} (not enough)`)

            t += 4
            console.log(`--- advance clock by 4 ticks ---`)
            console.log(`tokens after refill: ${bucket.tokens}`)

            const r3 = bucket.tryRemove(3)
            console.log(`tryRemove(3) → ${r3} | tokens: ${bucket.tokens}`)

            const r4 = bucket.take()
            console.log(`take()       → ${r4} | tokens: ${bucket.tokens}`)

            t += 100
            console.log(`--- advance clock by 100 ticks (capped at capacity) ---`)
            console.log(`tokens: ${bucket.tokens}`)

            const r5 = bucket.tryRemove(6)
            console.log(`tryRemove(6) → ${r5} (exceeds capacity of 5)`)
        }))
    }
    return (
        <DemoSection
            title="TokenBucket"
            description="Token-bucket rate limiter. Starts full, drains on each tryRemove/take call, and refills over time at a configurable rate. Inject a clock function for deterministic testing."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default TokenBucketDemo
