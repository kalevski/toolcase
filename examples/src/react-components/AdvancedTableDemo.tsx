import React, { useState, useCallback, useEffect } from 'react'
import {
	ActionItems,
	AdvancedTable,
	Badge,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'
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
	limit: number
	offset: number
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
			const data = filtered.slice(params.offset, params.offset + params.limit)

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
	{
		key: 'actions', header: '', width: '60px', align: 'right',
		render: (row) => <ActionItems items={[
			{ key: 'edit', label: 'Edit' },
			{ key: 'delete', label: 'Delete', },
			{ key: 'view', label: 'View' },
			{ key: 'promote', label: 'Promote to Admin' },
		]} />,
	},
]

const filters: AdvancedTableFilter[] = [
	{ key: 'search', type: 'text', label: 'Search', placeholder: 'Name or email…' },
	{
		key: 'role',
		type: 'dropdown',
		label: 'Role',
		placeholder: 'Select a role',
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
		placeholder: 'Select a status',
		items: [
			{ key: 'Active', name: 'Active' },
			{ key: 'Inactive', name: 'Inactive' },
		],
	},
	{ key: 'maxAge', type: 'range', label: 'Max Age', min: 22, max: 51, step: 1 },
]

const AdvancedTableDemo: React.FC = () => {
	const [offset, setOffset] = useState(0)
	const [filterValues, setFilterValues] = useState<Record<string, any>>({})
	const [sort, setSort] = useState<AdvancedTableSort | null>(null)

	const [data, setData] = useState<User[]>([])
	const [total, setTotal] = useState(0)
	const [loading, setLoading] = useState(true)

	const load = useCallback(() => {
		setLoading(true)
		fetchUsers({ limit: PAGE_SIZE, offset, filters: filterValues, sort }).then(({ data, total }) => {
			setData(data)
			setTotal(total)
			setLoading(false)
		})
	}, [offset, filterValues, sort])

	useEffect(() => { load() }, [load])

	const handleFilterChange = (key: string, value: any) => {
		setFilterValues((prev) => ({ ...prev, [key]: value }))
		setOffset(0)
	}

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="AdvancedTable"
				description="A data table with filters, sortable columns, pagination, and loading state — designed for backend-driven data."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Full Example">
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
					onSortChange={(s) => { setSort(s); setOffset(0) }}
					limit={PAGE_SIZE}
					offset={offset}
					total={total}
					onOffsetChange={setOffset}
					loading={loading}
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default AdvancedTableDemo
