import { useState } from 'react'
import { PriorityQueue } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const pq = new PriorityQueue(
  node => node.priority,
  node => node.task
)

pq.enqueue({ task: 'Send email', priority: 3 })
pq.enqueue({ task: 'Fix critical bug', priority: 1 })
pq.enqueue({ task: 'Update docs', priority: 5 })
pq.enqueue({ task: 'Deploy hotfix', priority: 2 })

while (pq.length > 0) {
  const item = pq.dequeue()
  // dequeues in order: 1, 2, 3, 5
}`

export const PriorityQueueDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const pq = new PriorityQueue<{ task: string; priority: number }>(
            node => node.priority,
            node => node.task
        )

        pq.enqueue({ task: 'Send email', priority: 3 })
        pq.enqueue({ task: 'Fix critical bug', priority: 1 })
        pq.enqueue({ task: 'Update docs', priority: 5 })
        pq.enqueue({ task: 'Deploy hotfix', priority: 2 })

        console.log('Queue length:', pq.length)
        console.log('Has "Fix critical bug":', pq.has({ task: 'Fix critical bug', priority: 1 }))

        while (pq.length > 0) {
            const item = pq.dequeue()!
            console.log(`Dequeued: [priority=${item.priority}] ${item.task}`)
        }
    }))
    return (
        <DemoSection
            title="PriorityQueue"
            description="Min-heap priority queue. Dequeues lowest-priority-number first. Supports uniqueness tracking."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default PriorityQueueDemo
