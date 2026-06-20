import { ReactNode } from 'react'

export type LogEntry = { time: string; text: string }

const ts = () => new Date().toLocaleTimeString()

export const captureLogs = (fn: () => void): LogEntry[] => {
    const entries: LogEntry[] = []
    const orig = console.log
    console.log = (...args: unknown[]) => entries.push({
        time: ts(),
        text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '),
    })
    try { fn() } finally { console.log = orig }
    return entries
}

export const ConsoleOutput = ({ logs }: { logs: LogEntry[] }) =>
    logs.length > 0 ? (
        <pre className="console-output">
            {logs.map((l, i) => (
                <div key={i}>
                    <span className="console-time">{l.time}</span> {l.text}
                </div>
            ))}
        </pre>
    ) : null

export type SerializerDemoProps = {
    title: string
    description: ReactNode
    code: string
    onRun: () => void
    logs: LogEntry[]
}

export const SerializerDemoCard = ({ title, description, code, onRun, logs }: SerializerDemoProps) => (
    <div className="card">
        <div className="card-body">
            <h3 className="card-title">{title}</h3>
            <p className="text-body-secondary">{description}</p>
            <tc-code-snippet language="typescript" code={code}></tc-code-snippet>
            <button type="button" className="btn btn-primary btn-sm" onClick={onRun}>
                Run
            </button>
            <ConsoleOutput logs={logs} />
        </div>
    </div>
)
