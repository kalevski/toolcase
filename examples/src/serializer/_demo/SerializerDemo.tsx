import { ReactNode } from 'react'
import { Button, Card, CodeSnippet, Heading, Text } from '@toolcase/react-components'

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
    <Card>
        <Heading as="h3">{title}</Heading>
        <Text as="p" variant="muted">{description}</Text>
        <CodeSnippet language="typescript" code={code} />
        <Button size="small" onClick={onRun}>Run</Button>
        <ConsoleOutput logs={logs} />
    </Card>
)
