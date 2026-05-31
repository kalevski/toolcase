import { useState } from 'react'
import { FILTER_OP_SET, type Filter, type Sort } from '@toolcase/node'
import { captureLogs, NodeDemoCard, type LogEntry } from './_demo/NodeDemo'

interface Post {
    id: number
    title: string
    status: string
    views: number
    publishedAt: Date | null
}

const code = `import type { Filter, Sort } from '@toolcase/node'

// Engine-neutral query description. @toolcase/node ships NO SQL builder —
// Filter / Sort are plain data your repository translates for its engine
// (SQL predicate, Mongo filter, key scan, …).

const where: Filter<Post> = {
    status: 'published',                 // eq
    views:  { gte: 100 },                // comparator
    title:  { ilike: '%toolcase%' },     // case-insensitive match
    publishedAt: { isNotNull: true },    // null test
    id:     { in: [1, 2, 3] },           // membership
}

const orderBy: Sort<Post>[] = [
    { field: 'views', direction: 'desc' },
    { field: 'publishedAt', direction: 'desc', nulls: 'last' },
    'id',                                 // bare string = ascending
]

// Pass straight to a repository / EntityService / RESTRouteHandler:
service.paginate({ where, orderBy, limit: 25 })

// Filter operator vocabulary (FILTER_OP_SET):
// eq ne gt gte lt lte like ilike in notIn isNull isNotNull`

export const FilterSortDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const where: Filter<Post> = {
            status: 'published',
            views: { gte: 100 },
            title: { ilike: '%toolcase%' },
            publishedAt: { isNotNull: true },
            id: { in: [1, 2, 3] },
        }
        const orderBy: Sort<Post>[] = [
            { field: 'views', direction: 'desc' },
            { field: 'publishedAt', direction: 'desc', nulls: 'last' },
            'id',
        ]
        console.log('Filter<Post>:', where)
        console.log('Sort<Post>[]:', orderBy)
        console.log('operators:', [...FILTER_OP_SET].join(' '))
    }))
    return (
        <NodeDemoCard
            title="Filter & Sort"
            description="Engine-neutral query-description types. @toolcase/node no longer ships a SQL builder — Filter / Sort are plain data your repository translates for its engine (Postgres, Mongo, anything)."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default FilterSortDemo
