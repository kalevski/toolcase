import { useState } from 'react'
import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'
import { captureLogs, LoggingDemoCard, type LogEntry } from './_demo/LoggingDemo'

const code = `import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'

const factory = new LoggerFactory([new ConsoleLogReporter()])
factory.level = 'verbose'

const logger = factory.getLogger('my-app')

logger.info('Server started on port 3000')
logger.debug('Loading configuration...')
logger.warning('Disk space below 10%')
logger.error('Connection to database failed')
logger.verbose('Request payload:', { method: 'GET', path: '/api/users' })`

export const BasicLoggingDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const factory = new LoggerFactory([new ConsoleLogReporter()])
        factory.level = 'verbose'
        const logger = factory.getLogger('my-app')
        logger.info('Server started on port 3000')
        logger.debug('Loading configuration...')
        logger.warning('Disk space below 10%')
        logger.error('Connection to database failed')
        logger.verbose('Request payload:', { method: 'GET', path: '/api/users' })
    }))
    return (
        <LoggingDemoCard
            title="Basic Usage"
            description="Create a logger factory, get a scoped logger, and log at different levels."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default BasicLoggingDemo
