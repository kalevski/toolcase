import { useState, ReactNode } from 'react'
import { Button, Card, CodeSnippet, Heading, Text } from '@toolcase/react-components'

export type LogEntry = { time: string; text: string; level?: string }

const ts = () => new Date().toLocaleTimeString()

export const captureConsole = (fn: () => void): LogEntry[] => {
    const logs: LogEntry[] = []
    const orig = {
        log: console.log,
        warn: console.warn,
        error: console.error,
    }
    const stringify = (a: unknown) =>
        typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
    console.log = (...args: unknown[]) => logs.push({ time: ts(), text: args.map(stringify).join(' '), level: 'info' })
    console.warn = (...args: unknown[]) => logs.push({ time: ts(), text: args.map(stringify).join(' '), level: 'warning' })
    console.error = (...args: unknown[]) => logs.push({ time: ts(), text: args.map(stringify).join(' '), level: 'error' })
    try { fn() } finally {
        console.log = orig.log
        console.warn = orig.warn
        console.error = orig.error
    }
    return logs
}

export const captureConsoleAsync = async (
    fn: (push: () => void) => Promise<void> | void,
    onUpdate: (entries: LogEntry[]) => void
) => {
    const entries: LogEntry[] = []
    const orig = {
        log: console.log,
        warn: console.warn,
        error: console.error,
    }
    const stringify = (a: unknown) =>
        typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)
    const push = (level: string) => (...args: unknown[]) => {
        entries.push({ time: ts(), text: args.map(stringify).join(' '), level })
        onUpdate([...entries])
    }
    console.log = push('info')
    console.warn = push('warning')
    console.error = push('error')
    try {
        await fn(() => onUpdate([...entries]))
    } finally {
        console.log = orig.log
        console.warn = orig.warn
        console.error = orig.error
    }
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

export type DemoSectionProps = {
    title: string
    description: ReactNode
    code: string
    language?: string
    onRun: () => void
    logs: LogEntry[]
    running?: boolean
    extra?: ReactNode
}

export const DemoSection = ({
    title,
    description,
    code,
    language = 'typescript',
    onRun,
    logs,
    running,
    extra,
}: DemoSectionProps) => (
    <Card>
        <Heading as="h3">{title}</Heading>
        <Text as="p" variant="muted">{description}</Text>
        <CodeSnippet code={code.trim()} language={language} />
        {extra}
        <Button size="small" onClick={onRun} disabled={running}>
            {running ? 'Running...' : 'Run'}
        </Button>
        <ConsoleOutput logs={logs} />
    </Card>
)
