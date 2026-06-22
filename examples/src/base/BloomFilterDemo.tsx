import { useState } from 'react'
import { BloomFilter } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `// 10k-bit filter, 7 hash functions — good for ~1000 items at <1% FPR
const bf = new BloomFilter(10000, 7)

bf.add('alice').add('bob').add('carol')

console.log(bf.has('alice'))  // true  — no false negatives, ever
console.log(bf.has('dave'))   // false — not added

// false-positive rate check: m=1000, k=3, n=100 → expected ≈ 1.7%
const filter = new BloomFilter(1000, 3)
for (let i = 0; i < 100; i++) filter.add(\`user:\${i}\`)

let fp = 0
for (let i = 100; i < 1100; i++) {
    if (filter.has(\`user:\${i}\`)) fp++
}
console.log(\`FPR: \${(fp / 10).toFixed(1)}%  (expected ≈ 1.7%)\`)`

export const BloomFilterDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const bf = new BloomFilter(10000, 7)
        bf.add('alice').add('bob').add('carol')

        console.log(`has('alice'): ${bf.has('alice')}`)
        console.log(`has('bob'):   ${bf.has('bob')}`)
        console.log(`has('carol'): ${bf.has('carol')}`)
        console.log(`has('dave'):  ${bf.has('dave')}`)

        console.log('--- false-positive rate (m=1000, k=3, n=100 items) ---')
        const filter = new BloomFilter(1000, 3)
        for (let i = 0; i < 100; i++) filter.add(`user:${i}`)

        let fp = 0
        for (let i = 100; i < 1100; i++) {
            if (filter.has(`user:${i}`)) fp++
        }
        console.log(`false positives: ${fp} / 1000 probes`)
        console.log(`FPR: ${(fp / 10).toFixed(1)}%  (expected ≈ 1.7%)`)
    }))
    return (
        <DemoSection
            title="BloomFilter"
            description="Probabilistic set membership. add/has run in O(k) time with zero allocations after construction. No false negatives guaranteed — every added item always returns true from has(). False positive rate is tunable via bit size and hash count."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default BloomFilterDemo
