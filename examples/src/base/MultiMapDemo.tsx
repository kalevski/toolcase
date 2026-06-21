import { useState } from 'react'
import { MultiMap } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const m = new MultiMap<string, string>()

m.set('fruit', 'apple').set('fruit', 'banana').set('fruit', 'cherry')
m.set('veggie', 'carrot').set('veggie', 'pea')

console.log('size (total values):', m.size)         // 5
console.log('fruit values:', [...m.get('fruit')!].sort())  // apple, banana, cherry
console.log('veggie values:', [...m.get('veggie')!].sort()) // carrot, pea

console.log('has fruit:', m.has('fruit'))            // true
console.log('has fruit apple:', m.has('fruit', 'apple'))   // true
console.log('has fruit kiwi:', m.has('fruit', 'kiwi'))     // false
console.log('get missing key:', m.get('grain'))      // undefined

// delete one value
m.delete('fruit', 'banana')
console.log('size after delete one:', m.size)        // 4
console.log('fruit after delete:', [...m.get('fruit')!].sort()) // apple, cherry

// delete all values under a key
m.delete('veggie')
console.log('size after delete key:', m.size)        // 2
console.log('has veggie:', m.has('veggie'))          // false

// iterate [key, Set<V>] pairs
console.log('keys:', [...m.keys()])`

export const MultiMapDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const m = new MultiMap<string, string>()

        m.set('fruit', 'apple').set('fruit', 'banana').set('fruit', 'cherry')
        m.set('veggie', 'carrot').set('veggie', 'pea')

        console.log('size (total values):', m.size)
        console.log('fruit values:', JSON.stringify([...m.get('fruit')!].sort()))
        console.log('veggie values:', JSON.stringify([...m.get('veggie')!].sort()))

        console.log('has fruit:', m.has('fruit'))
        console.log('has fruit apple:', m.has('fruit', 'apple'))
        console.log('has fruit kiwi:', m.has('fruit', 'kiwi'))
        console.log('get missing key:', m.get('grain'))

        m.delete('fruit', 'banana')
        console.log('size after delete one:', m.size)
        console.log('fruit after delete:', JSON.stringify([...m.get('fruit')!].sort()))

        m.delete('veggie')
        console.log('size after delete key:', m.size)
        console.log('has veggie:', m.has('veggie'))

        console.log('keys:', JSON.stringify([...m.keys()].sort()))
    }))
    return (
        <DemoSection
            title="MultiMap"
            description="Maps each key to a set of values. Accumulates values via set(); size counts total values across all keys. delete(key) removes all values; delete(key, value) removes one."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default MultiMapDemo
