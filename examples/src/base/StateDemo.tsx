import { useState } from 'react'
import { State } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const state = new State({ score: 0, player: { name: 'Alice' } })

state.on('state.score', (v) => console.log('score →', v))
state.on('state.player.name', (v) => console.log('name →', v))

state.set({ score: 10 })
state.set({ player: { name: 'Bob' } })
state.empty()`

export const StateDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const state = new State({ score: 0, player: { name: 'Alice' } })
        state.on('state', (v: unknown) => console.log('state changed:', JSON.stringify(v)))
        state.on('state.score', (v: unknown) => console.log('score →', v))
        state.on('state.player.name', (v: unknown) => console.log('player.name →', v))

        console.log('Initial:', JSON.stringify(state.get()))
        state.set({ score: 10 })
        state.set({ player: { name: 'Bob' } })
        console.log('After updates:', JSON.stringify(state.get()))

        state.empty()
        console.log('After empty():', JSON.stringify(state.get()))
    }))
    return (
        <DemoSection
            title="State"
            description="Observable object that emits granular events when properties change, including nested paths."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default StateDemo
