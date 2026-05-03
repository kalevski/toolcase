import { ReactNode } from 'react'
import { Button, Card, CodeSnippet, Heading, Text } from '@toolcase/react-components'

export type LogEntry = { time: string; text: string; level?: string }

const ts = () => new Date().toLocaleTimeString()

export const captureLogs = (fn: () => void): LogEntry[] => {
    const entries: LogEntry[] = []
    const orig = {
        log: console.log,
        warn: console.warn,
        error: console.error,
    }
    const stringify = (a: unknown) =>
        typeof a === 'object' ? JSON.stringify(a) : String(a)
    const push = (level: string) => (...args: unknown[]) =>
        entries.push({ time: ts(), text: args.map(stringify).join(' '), level })
    console.log = push('info')
    console.warn = push('warning')
    console.error = push('error')
    try { fn() } finally {
        console.log = orig.log
        console.warn = orig.warn
        console.error = orig.error
    }
    return entries
}

export const ConsoleOutput = ({ logs }: { logs: LogEntry[] }) =>
    logs.length > 0 ? (
        <pre className="console-output">
            {logs.map((l, i) => (
                <div key={i} className={l.level ? `console-level--${l.level}` : ''}>
                    <span className="console-time">{l.time}</span> {l.text}
                </div>
            ))}
        </pre>
    ) : null

export type LoggingDemoProps = {
    title: string
    description: ReactNode
    code: string
    onRun: () => void
    logs: LogEntry[]
    extra?: ReactNode
}

export const LoggingDemoCard = ({ title, description, code, onRun, logs, extra }: LoggingDemoProps) => (
    <Card>
        <Heading as="h3">{title}</Heading>
        <Text as="p" variant="muted">{description}</Text>
        <CodeSnippet language="typescript" code={code} />
        {extra}
        <Button size="small" onClick={onRun}>Run</Button>
        <ConsoleOutput logs={logs} />
    </Card>
)
