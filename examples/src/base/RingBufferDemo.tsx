import { useState } from 'react'
import { RingBuffer } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const rb = new RingBuffer<number>(4)

rb.push(1).push(2).push(3).push(4)
console.log('peek (oldest):', rb.peek())       // 1
console.log('tail(2):', rb.tail(2))            // [3, 4]
console.log('iteration:', [...rb])             // [1, 2, 3, 4]

rb.push(5)  // overflow — evicts 1
console.log('after overflow, peek:', rb.peek()) // 2
console.log('size:', rb.size)                   // 4

rb.clear()
console.log('after clear, size:', rb.size)     // 0`

export const RingBufferDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const rb = new RingBuffer<number>(4)

        rb.push(1).push(2).push(3).push(4)
        console.log('peek (oldest):', rb.peek())
        console.log('tail(2):', JSON.stringify(rb.tail(2)))
        console.log('iteration:', JSON.stringify([...rb]))

        rb.push(5)
        console.log('after overflow, peek:', rb.peek())
        console.log('size:', rb.size)

        rb.clear()
        console.log('after clear, size:', rb.size)
        console.log('peek after clear:', rb.peek())

        const log = new RingBuffer<string>(3)
        log.push('boot').push('connect').push('auth').push('ready')
        console.log('last 2 log entries:', JSON.stringify(log.tail(2)))
    }))
    return (
        <DemoSection
            title="RingBuffer"
            description="Fixed-capacity circular buffer. Oldest entry is overwritten on overflow. Use for rolling metrics, log windows, and replay buffers."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default RingBufferDemo
