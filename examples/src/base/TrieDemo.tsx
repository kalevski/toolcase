import { useState } from 'react'
import { Trie } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const t = new Trie()

t.insert('apple').insert('app').insert('application').insert('apt')
t.insert('banana').insert('band').insert('ban')
console.log('size:', t.size) // 7

console.log('has "apple":', t.has('apple'))   // true
console.log('has "app":', t.has('app'))       // true
console.log('has "ap":', t.has('ap'))         // false — not a terminal word

console.log('startsWith "app":', t.startsWith('app'))
console.log('startsWith "ban":', t.startsWith('ban'))
console.log('startsWith "xyz":', t.startsWith('xyz'))

t.delete('app')
console.log('has "app" after delete:', t.has('app'))     // false
console.log('has "apple" after delete:', t.has('apple')) // true
console.log('size after delete:', t.size)                // 6`

export const TrieDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const t = new Trie()

        t.insert('apple').insert('app').insert('application').insert('apt')
        t.insert('banana').insert('band').insert('ban')
        console.log('size:', t.size)

        console.log('has "apple":', t.has('apple'))
        console.log('has "app":', t.has('app'))
        console.log('has "ap":', t.has('ap'))

        console.log('startsWith "app":', JSON.stringify(t.startsWith('app').sort()))
        console.log('startsWith "ban":', JSON.stringify(t.startsWith('ban').sort()))
        console.log('startsWith "xyz":', JSON.stringify(t.startsWith('xyz')))

        t.delete('app')
        console.log('has "app" after delete:', t.has('app'))
        console.log('has "apple" after delete:', t.has('apple'))
        console.log('size after delete:', t.size)

        console.log('startsWith "" (all words):', JSON.stringify(t.startsWith('').sort()))
    }))
    return (
        <DemoSection
            title="Trie"
            description="Prefix tree for O(m) insert, lookup, and delete. startsWith(prefix) enumerates all matching words — ideal for autocomplete, command palettes, and dictionary search."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default TrieDemo
