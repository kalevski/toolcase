import { useState } from 'react'
import { Stack } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const s = new Stack<number>()

s.push(1).push(2).push(3)
console.log('size:', s.size)          // 3
console.log('peek:', s.peek())        // 3  (top, no removal)
console.log('pop:', s.pop())          // 3
console.log('pop:', s.pop())          // 2
console.log('size after pops:', s.size) // 1

s.clear()
console.log('after clear, isEmpty:', s.isEmpty()) // true

// iteration — bottom to top (insertion order)
const history = new Stack<string>()
history.push('login').push('dashboard').push('settings')
console.log('pages visited:', [...history])`

export const StackDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const s = new Stack<number>()

        s.push(1).push(2).push(3)
        console.log('size:', s.size)
        console.log('peek:', s.peek())
        console.log('pop:', s.pop())
        console.log('pop:', s.pop())
        console.log('size after pops:', s.size)

        s.clear()
        console.log('after clear, isEmpty:', s.isEmpty())

        const history = new Stack<string>()
        history.push('login').push('dashboard').push('settings')
        console.log('pages visited:', JSON.stringify([...history]))

        const undo = new Stack<string>()
        undo.push('type A').push('type B').push('delete C')
        console.log('undo last action:', undo.pop())
        console.log('undo again:', undo.pop())
        console.log('remaining undo steps:', undo.size)
    }))
    return (
        <DemoSection
            title="Stack"
            description="LIFO stack. push/pop at the top in O(1). Use for undo history, call stacks, balanced-bracket parsing, or any last-in-first-out queue."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default StackDemo
