import { useState } from 'react'
import { normalizeOffsetLimit, buildPage } from '@toolcase/node'
import { captureLogs, NodeDemoCard, type LogEntry } from './_demo/NodeDemo'

const code = `import { normalizeOffsetLimit, buildPage } from '@toolcase/node'

// Clamp + default user-supplied offset/limit
normalizeOffsetLimit({ offset: -5, limit: 999_999 }, { maxLimit: 100 })
//   → { offset: 0, limit: 100 }

normalizeOffsetLimit({ limit: 'abc' as any }, { defaultLimit: 25 })
//   → { offset: 0, limit: 25 }

// Build a paginated response envelope
buildPage([{ id: 1 }, { id: 2 }], 53, 0, 25)
//   → { results: [...], pagination: { offset: 0, limit: 25, count: 53 } }`

export const PaginationDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        console.log('clamped + maxed:',
            normalizeOffsetLimit({ offset: -5, limit: 999999 }, { maxLimit: 100 }))

        console.log('garbage limit -> default:',
            normalizeOffsetLimit({ limit: 'abc' as unknown as number }, { defaultLimit: 25 }))

        console.log('strict mode throws:')
        try {
            normalizeOffsetLimit({ limit: -1 }, { strict: true })
        } catch (error) {
            console.error((error as Error).message)
        }

        const page = buildPage(
            [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
            53,
            0,
            25,
        )
        console.log('page envelope:', page)
    }))
    return (
        <NodeDemoCard
            title="Pagination Helpers"
            description="normalizeOffsetLimit clamps untrusted input against defaults / max. buildPage produces the standard { results, pagination } response envelope used by BaseRepository.findPage."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default PaginationDemo
