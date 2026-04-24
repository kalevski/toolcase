import { useState } from 'react'
import {
	Alert,
	Avatar,
	Badge,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Select,
	Table,
	TableColumn
} from '@toolcase/react-components'

interface Member {
	id: string
	name: string
	email: string
	avatar?: string
	role: 'admin' | 'editor' | 'viewer'
	active: boolean
	joinedAt: string
}

const INITIAL_MEMBERS: Member[] = [
	{ id: '1', name: 'Rei Kuroda',   email: 'rei@orbitalgames.io',   role: 'admin',  active: true,  joinedAt: '2025-01-15' },
	{ id: '2', name: 'Jun Sato',     email: 'jun@orbitalgames.io',   role: 'editor', active: true,  joinedAt: '2025-03-08' },
	{ id: '3', name: 'Maya Takeda',  email: 'maya@orbitalgames.io',  role: 'viewer', active: false, joinedAt: '2025-06-22' },
	{ id: '4', name: 'Dan Bianchi',  email: 'dan@orbitalgames.io',   role: 'editor', active: true,  joinedAt: '2025-09-01' },
	{ id: '5', name: 'Eva Moreira',  email: 'eva@orbitalgames.io',   role: 'admin',  active: false, joinedAt: '2026-01-10' },
]

const ROLE_OPTIONS = [
	{ value: 'admin', label: 'Admin' },
	{ value: 'editor', label: 'Editor' },
	{ value: 'viewer', label: 'Viewer' },
]

const STATUS_OPTIONS = [
	{ value: 'true', label: 'Active' },
	{ value: 'false', label: 'Inactive' },
]

const formatDate = (iso: string) =>
	new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

const TableDemo = () => {
	const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS)
	const [clickedRow, setClickedRow] = useState<Member | null>(null)

	const updateMember = (id: string, patch: Partial<Member>) =>
		setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))

	const columns: TableColumn<Member>[] = [
		{
			key: 'user',
			header: 'Member',
			width: '260px',
			render: (row) => (
				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<Avatar name={row.name} src={row.avatar} size="small" />
					<div>
						<div style={{ fontWeight: 500 }}>{row.name}</div>
						<div style={{ fontSize: 12, color: '#94a3b8' }}>{row.email}</div>
					</div>
				</div>
			),
		},
		{
			key: 'role',
			header: 'Role',
			width: '140px',
			render: (row) => (
				<Select
					options={ROLE_OPTIONS}
					value={row.role}
					onChange={(e) => updateMember(row.id, { role: e.target.value as Member['role'] })}
				/>
			),
		},
		{
			key: 'status',
			header: 'Status',
			width: '140px',
			render: (row) => (
				<Select
					options={STATUS_OPTIONS}
					value={String(row.active)}
					onChange={(e) => updateMember(row.id, { active: e.target.value === 'true' })}
				/>
			),
		},
		{
			key: 'badge',
			header: '',
			width: '100px',
			align: 'center',
			render: (row) => (
				<Badge variant={row.active ? 'success' : 'danger'}>{row.active ? 'Active' : 'Inactive'}</Badge>
			),
		},
		{
			key: 'joined',
			header: 'Joined',
			width: '140px',
			render: (row) => <span>{formatDate(row.joinedAt)}</span>,
		},
	]

	const compactColumns: TableColumn<Member>[] = [
		{ key: 'name', header: 'Name', render: (row) => row.name },
		{ key: 'email', header: 'Email', render: (row) => row.email },
		{ key: 'role', header: 'Role', render: (row) => row.role },
	]

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="Table"
				description={
				<>
					A generic data table with typed columns, custom cell renderers, and a handful of
					orthogonal modifiers — <code>striped</code>, <code>hoverable</code>, <code>compact</code>,{' '}
					<code>borderless</code>. Built-in <code>loading</code> and empty-state support; use{' '}
					<code>AdvancedTable</code> when you need sorting, filtering, pagination, or bulk actions.
				</>
			}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Project members">
				<Table
					columns={columns}
					data={members}
					rowKey={(row) => row.id}
					emptyMessage="No members found"
					striped
				/>
			</SectionCard>

			<SectionCard title="Clickable rows">
				{clickedRow && (
					<div style={{ marginBottom: 12 }}>
						<Alert variant="info">
							Clicked: <strong>{clickedRow.name}</strong> ({clickedRow.role})
						</Alert>
					</div>
				)}
				<Table
					columns={compactColumns}
					data={members}
					rowKey={(row) => row.id}
					hoverable
					onRowClick={(row) => setClickedRow(row)}
				/>
			</SectionCard>

			<SectionCard title="Compact and borderless">
				<div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
					<div>
						<p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
							Compact
						</p>
						<Table columns={compactColumns} data={members} rowKey={(row) => row.id} compact />
					</div>
					<div>
						<p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
							Borderless
						</p>
						<Table columns={compactColumns} data={members} rowKey={(row) => row.id} borderless />
					</div>
				</div>
			</SectionCard>

			<SectionCard title="Loading and empty">
				<div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
					<div>
						<p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
							Loading · 4 skeleton rows
						</p>
						<Table
							columns={compactColumns}
							data={[]}
							rowKey={(row) => row.id}
							loading
							loadingRows={4}
						/>
					</div>
					<div>
						<p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
							Empty
						</p>
						<Table
							columns={compactColumns}
							data={[]}
							rowKey={(row) => row.id}
							emptyMessage="No members yet — invite someone to get started."
						/>
					</div>
				</div>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default TableDemo
