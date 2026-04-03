import { useState } from 'react'
import { State, retry } from '@toolcase/base'

type LogEntry = { time: string; text: string }

const captureConsole = (fn: () => void): LogEntry[] => {
    const logs: LogEntry[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => {
        logs.push({
            time: new Date().toLocaleTimeString(),
            text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
        })
    }
    try {
        fn()
    } finally {
        console.log = origLog
    }
    return logs
}

const StateExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = () => {
        const entries = captureConsole(() => {
            const state = new State({})
            state.on('state', (value: unknown) => console.log('changed to', value))
            console.log(JSON.stringify(state.get()))
            console.log('==== update 1 ====')
            state.set({ array1: [2], array2: { test: 1 } })
            console.log('==== update 2 ====')
            state.set({ array2: undefined })
            console.log('==== update 3 ====')
            state.set({ array2: [1, 2, 3] })
            console.log('==== update 4 ====')
            state.set({ testObject: { testA: { childA: 1 }, testB: { childB: [1, 2] } } })
            console.log('==== update 5 ====')
            state.set({ testObject: { testA: { childA: 2 } } })
            state.empty()
            console.log(JSON.stringify(state.get()))
        })
        setLogs(entries)
    }

    return (
        <div>
            <h3>State</h3>
            <p>Reactive state container from <code>@toolcase/base</code></p>
            <button className="btn btn-primary btn-sm" onClick={run}>Run Example</button>
            {logs.length > 0 && (
                <pre className="console-output">
                    {logs.map((l, i) => <div key={i}><span className="console-time">{l.time}</span> {l.text}</div>)}
                </pre>
            )}
        </div>
    )
}

const RetryExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [running, setRunning] = useState(false)

    const run = async () => {
        setRunning(true)
        setLogs([])
        const entries: LogEntry[] = []
        const origLog = console.log
        console.log = (...args: unknown[]) => {
            entries.push({
                time: new Date().toLocaleTimeString(),
                text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
            })
            setLogs([...entries])
        }

        const callAPI = async () =>
            new Promise<number>((resolve, reject) => {
                setTimeout(() => {
                    const canSucceed = Math.random() * 10000 > 7000
                    if (canSucceed) resolve(1)
                    else reject(new Error('random failure'))
                }, Math.floor(Math.random() * 500) + 100)
            })

        try {
            const result = await retry(callAPI, {
                minTimeout: 500,
                retries: 5,
                factor: 1.5,
                randomize: true,
            })
            console.log('Result:', result)
        } catch (err) {
            console.log('Failed after retries:', String(err))
        } finally {
            console.log = origLog
            setRunning(false)
        }
    }

    return (
        <div>
            <h3>Retry</h3>
            <p>Retry helper with exponential backoff from <code>@toolcase/base</code></p>
            <button className="btn btn-primary btn-sm" onClick={run} disabled={running}>
                {running ? 'Running...' : 'Run Example'}
            </button>
            {logs.length > 0 && (
                <pre className="console-output">
                    {logs.map((l, i) => <div key={i}><span className="console-time">{l.time}</span> {l.text}</div>)}
                </pre>
            )}
        </div>
    )
}

const baseExamples = [
    { key: 'state', label: 'State', element: <StateExample /> },
    { key: 'retry', label: 'Retry', element: <RetryExample /> },
]

export const BaseExamplesPage = () => {
    const [active, setActive] = useState('state')
    const current = baseExamples.find(e => e.key === active)

    return (
        <div className="example-menu">
            <div className="example-menu__header">
                <h1>@toolcase/base</h1>
                <p>JavaScript helper functions and data structures</p>
            </div>
            <div className="base-examples">
                <div className="base-examples__tabs">
                    {baseExamples.map(ex => (
                        <button
                            key={ex.key}
                            className={`base-examples__tab ${active === ex.key ? 'base-examples__tab--active' : ''}`}
                            onClick={() => setActive(ex.key)}
                        >
                            {ex.label}
                        </button>
                    ))}
                </div>
                <div className="base-examples__content">
                    {current?.element}
                </div>
            </div>
        </div>
    )
}
