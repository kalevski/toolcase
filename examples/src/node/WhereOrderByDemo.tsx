import { useState } from 'react'
import { applyWhere, applyOrderBy, type WhereClause, type OrderBy } from '@toolcase/node'
import { captureLogs, NodeDemoCard, type LogEntry } from './_demo/NodeDemo'

interface Post {
    id: number
    title: string
    status: string
    views: number
    publishedAt: Date | null
}

const code = `import { applyWhere, applyOrderBy } from '@toolcase/node'
// Same surface BaseRepository uses internally

// Operator forms — eq is default, but rich comparators are first-class
const where: WhereClause<Post> = {
    status: 'published',                 // eq
    views:  { gte: 100 },                // comparator
    title:  { ilike: '%toolcase%' },     // case-insensitive search
    publishedAt: { isNotNull: true },    // null tests
}

// Empty IN short-circuits to false (no DB round-trip)
applyWhere(qb, { id: { in: [] } })       // -> [qb, true /* empty */]

// orderBy accepts string, object, or array
const order: OrderBy<Post>[] = [
    { column: 'views', direction: 'desc' },
    { column: 'publishedAt', direction: 'desc', nulls: 'last' },
    'id',
]`

interface FakeQB {
    calls: Array<[string, ...unknown[]]>
    where: (...args: unknown[]) => FakeQB
    orderBy: (...args: unknown[]) => FakeQB
}

const makeQB = (): FakeQB => {
    const calls: Array<[string, ...unknown[]]> = []
    const qb: FakeQB = {
        calls,
        where(...args: unknown[]) { calls.push(['where', ...args]); return qb },
        orderBy(...args: unknown[]) { calls.push(['orderBy', ...args]); return qb },
    }
    return qb
}

export const WhereOrderByDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const where: WhereClause<Post> = {
            status: 'published',
            views: { gte: 100 },
            title: { ilike: '%toolcase%' },
            publishedAt: { isNotNull: true },
        }
        const qb1 = makeQB()
        const [, empty1] = applyWhere(qb1, where as Record<string, unknown>)
        console.log('where calls:', qb1.calls)
        console.log('empty?', empty1)

        const qb2 = makeQB()
        const [, empty2] = applyWhere(qb2, { id: { in: [] } })
        console.log('empty IN -> short-circuit:')
        console.log('  calls:', qb2.calls)
        console.log('  empty?', empty2)

        const order: OrderBy<Post>[] = [
            { column: 'views', direction: 'desc' },
            { column: 'publishedAt', direction: 'desc', nulls: 'last' },
            'id',
        ]
        const qb3 = makeQB()
        applyOrderBy(qb3, order)
        console.log('orderBy calls:', qb3.calls)
    }))
    return (
        <NodeDemoCard
            title="Where & OrderBy Builders"
            description="Composable WhereClause / OrderBy values that lower onto a Kysely-shaped query builder. Demo wraps a fake builder so you can see the resulting (column, op, value) calls."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default WhereOrderByDemo
