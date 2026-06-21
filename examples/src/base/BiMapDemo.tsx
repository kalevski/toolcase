import { useState } from 'react'
import { BiMap } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const m = new BiMap<string, number>()

m.set('alpha', 1).set('beta', 2).set('gamma', 3)
console.log('size:', m.size)          // 3
console.log('get alpha:', m.get('alpha'))     // 1
console.log('getKey 2:', m.getKey(2))         // 'beta'

console.log('has alpha:', m.has('alpha'))     // true
console.log('hasValue 3:', m.hasValue(3))    // true
console.log('hasValue 9:', m.hasValue(9))    // false

// Reassigning a value to a new key removes the old key
m.set('delta', 1)
console.log('has alpha after reassign:', m.has('alpha'))  // false
console.log('getKey 1:', m.getKey(1))                     // 'delta'
console.log('size after reassign:', m.size)               // 3

// delete by key
m.delete('beta')
console.log('has beta:', m.has('beta'))  // false
console.log('size:', m.size)             // 2

// delete by value
m.deleteByValue(3)
console.log('has gamma:', m.has('gamma'))  // false
console.log('size:', m.size)               // 1

// iterate [key, value] pairs
m.set('x', 10).set('y', 20)
console.log('entries:', JSON.stringify([...m]))`

export const BiMapDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const m = new BiMap<string, number>()

        m.set('alpha', 1).set('beta', 2).set('gamma', 3)
        console.log('size:', m.size)
        console.log('get alpha:', m.get('alpha'))
        console.log('getKey 2:', m.getKey(2))

        console.log('has alpha:', m.has('alpha'))
        console.log('hasValue 3:', m.hasValue(3))
        console.log('hasValue 9:', m.hasValue(9))

        m.set('delta', 1)
        console.log('has alpha after reassign:', m.has('alpha'))
        console.log('getKey 1:', m.getKey(1))
        console.log('size after reassign:', m.size)

        m.delete('beta')
        console.log('has beta:', m.has('beta'))
        console.log('size:', m.size)

        m.deleteByValue(3)
        console.log('has gamma:', m.has('gamma'))
        console.log('size:', m.size)

        m.set('x', 10).set('y', 20)
        console.log('entries:', JSON.stringify([...m]))
    }))
    return (
        <DemoSection
            title="BiMap"
            description="Bidirectional map enforcing a strict 1-to-1 relationship. Look up by key or by value in O(1). Reassigning a key or value automatically removes the displaced pair."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default BiMapDemo
