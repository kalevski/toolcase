import React from 'react'
import {
	EntityCell,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Table,
	TableColumn
} from '@toolcase/react-components'

interface Project {
	id: string
	name: string
	slug: string
	color: 'violet' | 'cyan' | 'emerald' | 'amber' | 'pink' | 'blue' | 'slate' | 'rose'
	initial: string
	members: number
}

const projects: Project[] = [
	{ id: '1', name: 'Atlas Platform', slug: 'atlas-prod', color: 'violet', initial: 'AT', members: 24 },
	{ id: '2', name: 'Beacon Analytics', slug: 'beacon', color: 'cyan', initial: 'BE', members: 12 },
	{ id: '3', name: 'Copper Logs', slug: 'copper', color: 'emerald', initial: 'CO', members: 7 },
	{ id: '4', name: 'Delta Workflows', slug: 'delta', color: 'amber', initial: 'DE', members: 15 },
]

const EntityCellDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="EntityCell"
				description={
			<>
				A compact list/table cell: a colored initial tile next to a two-line label. Colors
				come from the shared <code>EntityColor</code> palette so cells stay visually consistent
				across tables.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="In a table">
			<Table
				columns={[
					{
						key: 'name',
						header: 'Project',
						render: (row: Project) => (
							<EntityCell
								name={row.name}
								subLabel={row.slug}
								initial={row.initial}
								color={row.color}
								onClick={() => console.log('clicked', row.id)}
							/>
						),
					},
					{
						key: 'members',
						header: 'Members',
						render: (row: Project) => row.members,
						align: 'right',
					},
				] as TableColumn<Project>[]}
				data={projects}
				rowKey={(r) => r.id}
			/>
		</SectionCard>

		<SectionCard title="sm · md · lg">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<EntityCell size="sm" name="Atlas Platform" subLabel="atlas-prod" initial="AT" color="violet" />
				<EntityCell size="md" name="Atlas Platform" subLabel="atlas-prod" initial="AT" color="violet" />
				<EntityCell size="lg" name="Atlas Platform" subLabel="atlas-prod" initial="AT" color="violet" />
			</div>
		</SectionCard>

		<SectionCard title="Color tokens">
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
				<EntityCell name="Violet" subLabel="token" initial="VI" color="violet" />
				<EntityCell name="Cyan" subLabel="token" initial="CY" color="cyan" />
				<EntityCell name="Emerald" subLabel="token" initial="EM" color="emerald" />
				<EntityCell name="Amber" subLabel="token" initial="AM" color="amber" />
				<EntityCell name="Pink" subLabel="token" initial="PI" color="pink" />
				<EntityCell name="Blue" subLabel="token" initial="BL" color="blue" />
				<EntityCell name="Slate" subLabel="token" initial="SL" color="slate" />
				<EntityCell name="Rose" subLabel="token" initial="RO" color="rose" />
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default EntityCellDemo
