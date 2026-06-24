import { useState } from 'react'
import { formatDuration, formatNumber, relativeTime } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `// formatDuration — milliseconds to human-readable
formatDuration(500)         // '500ms'
formatDuration(90000)       // '1m 30s'
formatDuration(5400000)     // '1h 30m'
formatDuration(90000000)    // '1d 1h'

// formatNumber — thousands separator + compact notation
formatNumber(1234567)                   // '1,234,567'
formatNumber(1200, { compact: true })   // '1.2k'
formatNumber(3400000, { compact: true }) // '3.4M'
formatNumber(2500000000, { compact: true }) // '2.5B'

// relativeTime — relative to now
relativeTime(new Date(Date.now() - 3 * 60 * 1000))  // '3 minutes ago'
relativeTime(new Date(Date.now() + 2 * 3600 * 1000)) // 'in 2 hours'`

export const FormattingDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])

    const run = () => setLogs(captureConsole(() => {
        console.log('── formatDuration ──')
        console.log('500ms:', formatDuration(500))
        console.log('1s:', formatDuration(1000))
        console.log('1m 30s:', formatDuration(90000))
        console.log('1h 30m:', formatDuration(5400000))
        console.log('1d 1h:', formatDuration(90000000))
        console.log('0:', formatDuration(0))

        console.log('')
        console.log('── formatNumber ──')
        console.log('999:', formatNumber(999))
        console.log('1000:', formatNumber(1000))
        console.log('1234567:', formatNumber(1234567))
        console.log('1.2k:', formatNumber(1200, { compact: true }))
        console.log('3.4M:', formatNumber(3400000, { compact: true }))
        console.log('2.5B:', formatNumber(2500000000, { compact: true }))
        console.log('-1.2k:', formatNumber(-1200, { compact: true }))

        console.log('')
        console.log('── relativeTime ──')
        const now = Date.now()
        console.log('500ms ago:', relativeTime(new Date(now - 500)))
        console.log('30s ago:', relativeTime(new Date(now - 30_000)))
        console.log('3m ago:', relativeTime(new Date(now - 3 * 60_000)))
        console.log('2h ago:', relativeTime(new Date(now - 2 * 3_600_000)))
        console.log('3d ago:', relativeTime(new Date(now - 3 * 86_400_000)))
        console.log('in 5m:', relativeTime(new Date(now + 5 * 60_000)))
        console.log('in 2h:', relativeTime(new Date(now + 2 * 3_600_000)))
    }))

    return (
        <DemoSection
            title="Formatting Helpers"
            description="formatDuration converts milliseconds to human-readable text; formatNumber adds thousands separators and compact notation; relativeTime turns a date into a human-friendly relative string."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default FormattingDemo
