import { useState } from 'react'
import { LoggerFactory } from '@toolcase/logging'
import { Button, Card, CodeSnippet, Heading, Text } from '@toolcase/react-components'
import { ConsoleOutput, type LogEntry } from './_demo/LoggingDemo'

const code = `import { LogReporter, LoggerFactory } from '@toolcase/logging'

class RemoteReporter extends LogReporter {
  log(level, scope, time, messages) {
    fetch('/api/logs', {
      method: 'POST',
      body: JSON.stringify({ level, scope, time, messages })
    })
  }
}

const factory = new LoggerFactory([
  new ConsoleLogReporter(),  // logs to console
  new RemoteReporter()       // also sends to API
])`

export const CustomReporterDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        const entries: LogEntry[] = []
        const ts = () => new Date().toLocaleTimeString()

        const factory = new LoggerFactory([
            {
                log(level: string, scope: string, _time: string, messages: any[]) {
                    entries.push({
                        time: ts(),
                        text: `[Custom] ${level.toUpperCase()} | ${scope} | ${messages.join(' ')}`,
                        level,
                    })
                }
            } as any,
        ])
        factory.level = 'verbose'
        const logger = factory.getLogger('custom-demo')

        logger.info('Custom reporter captured this')
        logger.warning('Warnings work too')
        logger.debug('Debug info here')

        setLogs(entries)
    }

    return (
        <Card>
            <Heading as="h3">Custom Reporter</Heading>
            <Text as="p" variant="muted">
                Extend <code>LogReporter</code> to send logs anywhere — files, remote APIs, or custom formats.
            </Text>
            <CodeSnippet language="typescript" code={code} />
            <Button size="small" onClick={run}>Run</Button>
            <ConsoleOutput logs={logs} />
        </Card>
    )
}

export default CustomReporterDemo
