import React, { useState, useCallback, useEffect } from 'react'
import { AdvancedTable, Card, CodeSnippet, Badge } from '@toolcase/react-components'
import type { AdvancedTableFilter, AdvancedTableSort, TableColumn } from '@toolcase/react-components'

// ── Fake data ──────────────────────────────────────────────────────────────────

interface User {
	id: number
	name: string
	email: string
	role: string
	status: string
	age: number
}

const ALL_USERS: User[] = Array.from({ length: 53 }, (_, i) => ({
	id: i + 1,
	name: ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Hank', 'Ivy', 'Jack'][i % 10] + ` #${i + 1}`,
	email: `user${i + 1}@example.com`,
	role: ['Admin', 'Editor', 'Viewer'][i % 3],
	status: i % 5 === 0 ? 'Inactive' : 'Active',
	age: 22 + (i % 30),
}))

const PAGE_SIZE = 7

// Simulates a backend call
function fetchUsers(params: {
	page: number
	filters: Record<string, any>
	sort: AdvancedTableSort | null
}): Promise<{ data: User[]; total: number }> {
	return new Promise((resolve) => {
		setTimeout(() => {
			let filtered = [...ALL_USERS]

			if (params.filters.search) {
				const q = (params.filters.search as string).toLowerCase()
				filtered = filtered.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
			}
			if (params.filters.role) {
				filtered = filtered.filter((u) => u.role === params.filters.role)
			}
			if (params.filters.status) {
				filtered = filtered.filter((u) => u.status === params.filters.status)
			}
			if (params.filters.maxAge !== undefined && params.filters.maxAge !== '') {
				filtered = filtered.filter((u) => u.age <= Number(params.filters.maxAge))
			}

			if (params.sort) {
				const dir = params.sort.direction === 'asc' ? 1 : -1
				const key = params.sort.key as keyof User
				filtered.sort((a, b) => {
					const av = a[key]
					const bv = b[key]
					if (typeof av === 'string') return av.localeCompare(bv as string) * dir
					return ((av as number) - (bv as number)) * dir
				})
			}

			const total = filtered.length
			const start = (params.page - 1) * PAGE_SIZE
			const data = filtered.slice(start, start + PAGE_SIZE)

			resolve({ data, total })
		}, 400)
	})
}

// ── Demo ───────────────────────────────────────────────────────────────────────

const columns: TableColumn<User>[] = [
	{ key: 'id', header: 'ID', width: '60px', align: 'center', render: (r) => r.id },
	{ key: 'name', header: 'Name', render: (r) => r.name },
	{ key: 'email', header: 'Email', render: (r) => r.email },
	{ key: 'role', header: 'Role', render: (r) => r.role },
	{
		key: 'status',
		header: 'Status',
		render: (r) => (
			<Badge variant={r.status === 'Active' ? 'success' : 'secondary'}>{r.status}</Badge>
		),
	},
	{ key: 'age', header: 'Age', align: 'right', render: (r) => r.age },
]

const filters: AdvancedTableFilter[] = [
	{ key: 'search', type: 'text', label: 'Search', placeholder: 'Name or email…' },
	{
		key: 'role',
		type: 'dropdown',
		label: 'Role',
		items: [
			{ key: 'Admin', name: 'Admin' },
			{ key: 'Editor', name: 'Editor' },
			{ key: 'Viewer', name: 'Viewer' },
		],
	},
	{
		key: 'status',
		type: 'dropdown',
		label: 'Status',
		items: [
			{ key: 'Active', name: 'Active' },
			{ key: 'Inactive', name: 'Inactive' },
		],
	},
	{ key: 'maxAge', type: 'range', label: 'Max Age', min: 22, max: 51, step: 1 },
]

const AdvancedTableDemo: React.FC = () => {
	const [page, setPage] = useState(1)
	const [filterValues, setFilterValues] = useState<Record<string, any>>({})
	const [sort, setSort] = useState<AdvancedTableSort | null>(null)

	const [data, setData] = useState<User[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)

	const load = useCallback(() => {
		setLoading(true)
		fetchUsers({ page, filters: filterValues, sort }).then(({ data, total }) => {
			setData(data)
			setTotal(total)
			setLoading(false)
		})
	}, [page, filterValues, sort])

	useEffect(() => { load() }, [load])

	const handleFilterChange = (key: string, value: any) => {
		setFilterValues((prev) => ({ ...prev, [key]: value }))
		setPage(1)
	}

	const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">AdvancedTable</h1>
					<p className="text-muted mb-0">A data table with filters, sortable columns, pagination, and loading state — designed for backend-driven data.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Full Example</h2>
						<AdvancedTable<User>
							columns={columns}
							data={data}
							rowKey={(r) => r.id}
							emptyMessage="No users found."
							hoverable
							filters={filters}
							filterValues={filterValues}
							onFilterChange={handleFilterChange}
							sortableColumns={['name', 'email', 'age']}
							sort={sort}
							onSortChange={(s) => { setSort(s); setPage(1) }}
							page={page}
							pageSize={PAGE_SIZE}
							totalPages={totalPages}
							totalResults={total}
							onPageChange={setPage}
							loading={loading}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { AdvancedTable } from '@toolcase/react-components'
import type { AdvancedTableFilter, AdvancedTableSort, TableColumn } from '@toolcase/react-components'

const columns: TableColumn<User>[] = [
  { key: 'id', header: 'ID', render: (r) => r.id },
  { key: 'name', header: 'Name', render: (r) => r.name },
]

const filters: AdvancedTableFilter[] = [
  { key: 'search', type: 'text', label: 'Search' },
  { key: 'role', type: 'dropdown', label: 'Role', options: [...] },
  { key: 'maxAge', type: 'range', label: 'Max Age', min: 0, max: 100 },
]

<AdvancedTable
  columns={columns}
  data={data}
  rowKey={(r) => r.id}
  filters={filters}
  filterValues={filterValues}
  onFilterChange={(key, value) => { /* update state, re-fetch */ }}
  sortableColumns={['name']}
  sort={sort}
  onSortChange={setSort}
  page={page}
  pageSize={10}
  totalPages={totalPages}
  totalResults={total}
  onPageChange={setPage}
  loading={loading}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default AdvancedTableDemo
