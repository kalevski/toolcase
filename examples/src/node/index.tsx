import { JSX } from 'react'
import SanitizeDemo from './SanitizeDemo'
import PaginationDemo from './PaginationDemo'
import FilterSortDemo from './FilterSortDemo'
import ErrorsDemo from './ErrorsDemo'
import RepositoryDemo from './RepositoryDemo'
import EndpointDemo from './EndpointDemo'
import KVServiceDemo from './KVServiceDemo'

export type NodeExampleDef = {
    key: string
    label: string
    element: JSX.Element
}

export const nodeExamples: NodeExampleDef[] = [
    { key: 'sanitize', label: 'API Sanitizer', element: <SanitizeDemo /> },
    { key: 'pagination', label: 'Pagination', element: <PaginationDemo /> },
    { key: 'filter-sort', label: 'Filter & Sort', element: <FilterSortDemo /> },
    { key: 'errors', label: 'Domain Errors', element: <ErrorsDemo /> },
    { key: 'repository', label: 'Repository', element: <RepositoryDemo /> },
    { key: 'endpoint', label: 'Endpoint', element: <EndpointDemo /> },
    { key: 'kv', label: 'KVService', element: <KVServiceDemo /> },
]
