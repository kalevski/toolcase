import { useState } from 'react'
import { Deque } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const d = new Deque<number>()

d.pushBack(2).pushBack(3).pushFront(1)
console.log('front:', d.peekFront())   // 1
console.log('back:', d.peekBack())     // 3
console.log('size:', d.size)           // 3
console.log('all items:', [...d])      // [1, 2, 3]

console.log('popFront:', d.popFront()) // 1
console.log('popBack:', d.popBack())   // 3
console.log('remaining:', d.peekFront()) // 2

d.clear()
console.log('after clear, isEmpty:', d.isEmpty()) // true`

export const DequeDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const d = new Deque<number>()

        d.pushBack(2).pushBack(3).pushFront(1)
        console.log('front:', d.peekFront())
        console.log('back:', d.peekBack())
        console.log('size:', d.size)
        console.log('all items:', JSON.stringify([...d]))

        console.log('popFront:', d.popFront())
        console.log('popBack:', d.popBack())
        console.log('remaining peekFront:', d.peekFront())

        d.clear()
        console.log('after clear, isEmpty:', d.isEmpty())

        const taskQueue = new Deque<string>()
        taskQueue.pushBack('task-1')
        taskQueue.pushBack('task-2')
        taskQueue.pushFront('urgent-0')
        console.log('next task (front):', taskQueue.popFront())
        console.log('queue size:', taskQueue.size)
        console.log('remaining:', JSON.stringify([...taskQueue]))
    }))
    return (
        <DemoSection
            title="Deque"
            description="Double-ended queue (doubly-linked list). O(1) push/pop at both ends. Use for sliding windows, breadth-first search, undo-redo buffers, or any queue where you need O(1) front and back access."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default DequeDemo
