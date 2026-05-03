import { useState } from 'react'
import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'
import { Select } from '@toolcase/react-components'
import { captureLogs, LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const levelOptions = [
    { value: 'silent', label: 'silent' },
    { value: 'error', label: 'error' },
    { value: 'warning', label: 'warning' },
    { value: 'info', label: 'info' },
    { value: 'debug', label: 'debug' },
    { value: 'verbose', label: 'verbose' },
]

const buildCode = (level: string) => {
    const has = (l: string) => ['error', 'warning', 'info', 'debug', 'verbose'].indexOf(level) >= ['error', 'warning', 'info', 'debug', 'verbose'].indexOf(l)
    return `const factory = new LoggerFactory([new ConsoleLogReporter()])
factory.level = '${level}'  // only ${level} and below will show

logger.error('...')    // ${has('error') ? '✓' : '✗'}
logger.warning('...')  // ${has('warning') ? '✓' : '✗'}
logger.info('...')     // ${has('info') ? '✓' : '✗'}
logger.debug('...')    // ${has('debug') ? '✓' : '✗'}
logger.verbose('...')  // ${has('verbose') ? '✓' : '✗'}`
}

export const LogLevelsDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [level, setLevel] = useState<string>('info')

    const run = () => setLogs(captureLogs(() => {
        const factory = new LoggerFactory([new ConsoleLogReporter()])
        factory.level = level as any
        const logger = factory.getLogger('level-demo')
        logger.error('This is an error')
        logger.warning('This is a warning')
        logger.info('This is info')
        logger.debug('This is debug')
        logger.verbose('This is verbose')
    }))

    const description = (
        <>
            Set the factory level to filter messages. Only levels at or below the threshold are emitted.
            <br />
            Order: <code>silent</code> → <code>error</code> → <code>warning</code> → <code>info</code> → <code>debug</code> → <code>verbose</code>
        </>
    )

    return (
        <LoggingDemoCard
            title="Log Levels"
            description={description}
            code={buildCode(level)}
            onRun={run}
            logs={logs}
            extra={
                <div className="mb-2" style={{ maxWidth: 240 }}>
                    <Select
                        label="Level"
                        options={levelOptions}
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                    />
                </div>
            }
        />
    )
}

export default LogLevelsDemo
