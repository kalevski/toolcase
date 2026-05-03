import { useState } from 'react'
import { LSystem } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `// Fibonacci-like growth
const lsystem = new LSystem({
  axiom: 'A',
  rules: { A: 'AB', B: 'A' }
})

lsystem.iterate() // 'AB'
lsystem.iterate() // 'ABA'
lsystem.iterate() // 'ABAAB'

// Tree branching
const tree = new LSystem({
  axiom: 'X',
  rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }
})`

export const LSystemDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const lsystem = new LSystem({
            axiom: 'A',
            rules: { A: 'AB', B: 'A' }
        })

        console.log('Initial:', lsystem.state)
        for (let i = 0; i < 7; i++) {
            lsystem.iterate()
            console.log(`Iteration ${lsystem.iteration}: ${lsystem.state} (length: ${lsystem.state.length})`)
        }

        console.log('')
        const tree = new LSystem({
            axiom: 'X',
            rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }
        })
        console.log('Tree L-System:')
        console.log('Start:', tree.state)
        for (let i = 0; i < 3; i++) {
            tree.iterate()
            console.log(`Iteration ${tree.iteration}: (length ${tree.state.length})`)
        }
    }))
    return (
        <DemoSection
            title="LSystem"
            description="Lindenmayer system for procedural generation. Iteratively rewrites a string using production rules."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default LSystemDemo
