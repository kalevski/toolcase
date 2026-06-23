import { useState } from 'react'
import { BPlusIndex, MemoryAdapter } from '@toolcase/base'
import { captureConsoleAsync, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const enc = new TextEncoder()
const dec = new TextDecoder()

const idx = await BPlusIndex.open<string, string>({
    ...BPlusIndex.keyPreset.string,
    adapter: new MemoryAdapter(),
    serializeValue: v => enc.encode(v),
    deserializeValue: b => dec.decode(b),
})

// Insert / lookup / delete
await idx.set('banana', 'yellow fruit')
await idx.set('apple', 'red fruit')
await idx.set('cherry', 'red berry')

console.log('has apple:', await idx.has('apple'))   // true
console.log('get apple:', await idx.get('apple'))   // 'red fruit'
console.log('has mango:', await idx.has('mango'))   // false

await idx.delete('banana')
console.log('has banana after delete:', await idx.has('banana'))   // false

// Batch ops
await idx.setMany([
    ['date', 'sweet fruit'],
    ['elderberry', 'dark berry'],
    ['fig', 'sweet fruit'],
])
const batch = await idx.getMany(['fig', 'date', 'mango'])
console.log('getMany [fig, date, mango]:', batch)
// ['sweet fruit', 'sweet fruit', undefined]

// Ordered queries
console.log('first:', await idx.first())   // ['apple', 'red fruit']
console.log('last:', await idx.last())     // ['fig', 'sweet fruit']

// range scan c → e (inclusive)
const keys = []
for await (const [k] of idx.range({ gte: 'c', lte: 'e' })) keys.push(k)
console.log('range c–e:', keys)   // ['cherry', 'date', 'elderberry']

// rank (0-based position in sorted order)
console.log('rank of cherry:', await idx.rank('cherry'))   // 1

// stats
const s = await idx.stats()
console.log('stats:', s)`

export const BPlusIndexDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [running, setRunning] = useState(false)

    const run = async () => {
        setRunning(true)
        setLogs([])
        await captureConsoleAsync(async () => {
            const enc = new TextEncoder()
            const dec = new TextDecoder()

            const idx = await BPlusIndex.open<string, string>({
                ...BPlusIndex.keyPreset.string,
                adapter: new MemoryAdapter(),
                serializeValue: v => enc.encode(v),
                deserializeValue: b => dec.decode(b),
            })

            // Individual ops
            await idx.set('banana', 'yellow fruit')
            await idx.set('apple', 'red fruit')
            await idx.set('cherry', 'red berry')

            console.log('has apple:', await idx.has('apple'))
            console.log('get apple:', await idx.get('apple'))
            console.log('has mango:', await idx.has('mango'))

            await idx.delete('banana')
            console.log('has banana after delete:', await idx.has('banana'))

            // Batch ops
            await idx.setMany([
                ['date', 'sweet fruit'],
                ['elderberry', 'dark berry'],
                ['fig', 'sweet fruit'],
            ])
            const batch = await idx.getMany(['fig', 'date', 'mango'])
            console.log('getMany [fig, date, mango]:', JSON.stringify(batch))

            // Ordered queries
            const first = await idx.first()
            const last = await idx.last()
            console.log('first:', JSON.stringify(first))
            console.log('last:', JSON.stringify(last))

            // range scan c → e (inclusive)
            const rangeKeys: string[] = []
            for await (const [k] of idx.range({ gte: 'c', lte: 'e' })) {
                rangeKeys.push(k)
            }
            console.log('range c–e:', JSON.stringify(rangeKeys))

            // rank (0-based count of entries strictly before the key)
            const cherryRank = await idx.rank('cherry')
            console.log('rank of cherry:', cherryRank)

            // stats
            const s = await idx.stats()
            console.log(
                'stats:',
                `height=${s.height} pages=${s.pageCount} free=${s.freePages} fill=${s.fillFactor.toFixed(2)}`
            )
        }, setLogs)
        setRunning(false)
    }

    return (
        <DemoSection
            title="BPlusIndex"
            description="Persistent ordered B+ tree index backed by MemoryAdapter. Demonstrates insert/lookup/delete, batch setMany/getMany, ordered queries (range, first, last, rank), and stats()."
            code={code}
            onRun={run}
            logs={logs}
            running={running}
        />
    )
}

export default BPlusIndexDemo
