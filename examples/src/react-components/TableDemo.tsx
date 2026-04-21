import { useState } from 'react'
import { Table, TableColumn, Avatar, Select, Badge, Card, CodeSnippet, Alert } from '@toolcase/react-components'

interface User {
	id: string
	name: string
	email: string
	avatar?: string
	role: string
	active: boolean
	joinedAt: string
}

const initialUsers: User[] = [
	{ id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'admin', active: true, joinedAt: '2025-01-15' },
	{ id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'editor', active: true, joinedAt: '2025-03-08' },
	{ id: '3', name: 'Carol Lee', email: 'carol@example.com', role: 'viewer', active: false, joinedAt: '2025-06-22' },
	{ id: '4', name: 'Dan Miller', email: 'dan@example.com', role: 'editor', active: true, joinedAt: '2025-09-01' },
	{ id: '5', name: 'Eva Garcia', email: 'eva@example.com', role: 'admin', active: false, joinedAt: '2026-01-10' },
]

const roleOptions = [
	{ value: 'admin', label: 'Admin' },
	{ value: 'editor', label: 'Editor' },
	{ value: 'viewer', label: 'Viewer' },
]

const activeOptions = [
	{ value: 'true', label: 'Active' },
	{ value: 'false', label: 'Inactive' },
]

const formatDate = (dateStr: string) => {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	})
}

const TableDemo = () => {
	const [users, setUsers] = useState<User[]>(initialUsers)
	const [clickedRow, setClickedRow] = useState<string | null>(null)

	const updateUser = (id: string, patch: Partial<User>) => {
		setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
	}

	const columns: TableColumn<User>[] = [
		{
			key: 'user',
			header: 'User',
			width: '280px',
			render: (row) => (
				<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
					<Avatar name={row.name} src={row.avatar} size="small" />
					<div>
						<div style={{ fontWeight: 500 }}>{row.name}</div>
						<div style={{ fontSize: '12px', color: '#94a3b8' }}>{row.email}</div>
					</div>
				</div>
			),
		},
		{
			key: 'role',
			header: 'Role',
			width: '150px',
			render: (row) => (
				<Select
					options={roleOptions}
					value={row.role}
					onChange={(e) => updateUser(row.id, { role: e.target.value })}
				/>
			),
		},
		{
			key: 'active',
			header: 'Status',
			width: '140px',
			render: (row) => (
				<Select
					options={activeOptions}
					value={String(row.active)}
					onChange={(e) => updateUser(row.id, { active: e.target.value === 'true' })}
				/>
			),
		},
		{
			key: 'badge',
			header: '',
			width: '100px',
			align: 'center',
			render: (row) => (
				<Badge variant={row.active ? 'success' : 'danger'}>
					{row.active ? 'Active' : 'Inactive'}
				</Badge>
			),
		},
		{
			key: 'joined',
			header: 'Joined',
			width: '140px',
			render: (row) => <span>{formatDate(row.joinedAt)}</span>,
		},
	]

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Table</h1>
					<p className="text-muted mb-4">A generic data table with typed columns, custom cell renderers, striped rows, and interactive elements.</p>
				</div>
			</div>
			<div className="row">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Project Members</h2>
						<Table
							columns={columns}
							data={users}
							rowKey={(row) => row.id}
							emptyMessage="No members found"
							striped
						/>
					</Card>
				</div>
			</div>

			<div className="row mt-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Hoverable + onRowClick</h2>
						{clickedRow && (
							<Alert variant="info" className="mb-3">Clicked row: {clickedRow}</Alert>
						)}
						<Table
							columns={[
								{ key: 'name', header: 'Name', render: (row) => row.name },
								{ key: 'role', header: 'Role', render: (row) => row.role },
								{ key: 'joined', header: 'Joined', render: (row) => formatDate(row.joinedAt) },
							]}
							data={users}
							rowKey={(row) => row.id}
							hoverable
							onRowClick={(row) => setClickedRow(`${row.name} (${row.role})`)}
						/>
					</Card>
				</div>
			</div>

			<div className="row mt-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Compact</h2>
						<Table
							columns={[
								{ key: 'name', header: 'Name', render: (row) => row.name },
								{ key: 'email', header: 'Email', render: (row) => row.email },
							]}
							data={users}
							rowKey={(row) => row.id}
							compact
						/>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Borderless</h2>
						<Table
							columns={[
								{ key: 'name', header: 'Name', render: (row) => row.name },
								{ key: 'email', header: 'Email', render: (row) => row.email },
							]}
							data={users}
							rowKey={(row) => row.id}
							borderless
						/>
					</Card>
				</div>
			</div>

			<div className="row mt-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Loading State</h2>
						<Table
							columns={[
								{ key: 'name', header: 'Name', render: (row) => row.name },
								{ key: 'role', header: 'Role', render: (row) => row.role },
								{ key: 'joined', header: 'Joined', render: (row) => formatDate(row.joinedAt) },
							]}
							data={[]}
							rowKey={(row) => row.id}
							loading
							loadingRows={4}
						/>
					</Card>
				</div>
			</div>

			{/* Usage */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { Table, TableColumn } from '@toolcase/react-components'

const columns: TableColumn<User>[] = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
  { key: 'role', header: 'Role' },
]

<Table columns={columns} data={users} rowKey={(r) => r.id} />
<Table columns={columns} data={users} rowKey={(r) => r.id} striped hoverable compact />
<Table columns={columns} data={users} rowKey={(r) => r.id} onRowClick={(row) => console.log(row)} />
<Table columns={columns} data={[]} rowKey={(r) => r.id} loading loadingRows={4} />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default TableDemo
