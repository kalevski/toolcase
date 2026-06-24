import { JSX } from 'react'
import SanitizeDemo from './SanitizeDemo'
import PaginationDemo from './PaginationDemo'
import FilterSortDemo from './FilterSortDemo'
import ErrorsDemo from './ErrorsDemo'
import RepositoryDemo from './RepositoryDemo'
import EndpointDemo from './EndpointDemo'
import KVServiceDemo from './KVServiceDemo'
import NodeStoreDemo from './NodeStoreDemo'
import OAuth2Demo from './OAuth2Demo'
import ImagingDemo from './ImagingDemo'
import EnvDemo from './EnvDemo'

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
    { key: 'node-store', label: 'NodeStore', element: <NodeStoreDemo /> },
    { key: 'oauth2', label: 'OAuth2 / OIDC', element: <OAuth2Demo /> },
    { key: 'imaging', label: 'Imaging', element: <ImagingDemo /> },
    { key: 'env', label: 'env (typed loader)', element: <EnvDemo /> },
]
