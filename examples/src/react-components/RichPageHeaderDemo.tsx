import React from 'react'
import {
	Button,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const RichPageHeaderDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Layout & Surfaces</RichPageHeaderChip>}
				title="RichPageHeader"
				description={
			<>
				A page-level hero header: tinted icon tile, optional chip row, title, sub, description,
				and a right-aligned <code>actions</code> slot. Use it at the top of dashboard, settings,
				and detail pages — anywhere a page needs context before the content.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Full hero">
			<RichPageHeader
				icon={{ name: 'hdd-stack', color: 'violet' }}
				chips={
					<>
						<RichPageHeaderChip icon="check-circle">Active</RichPageHeaderChip>
						<RichPageHeaderChip icon="geo-alt">us-west-2</RichPageHeaderChip>
						<RichPageHeaderChip icon="shield-check">Production</RichPageHeaderChip>
					</>
				}
				title="atlas-prod-cluster"
				sub="Postgres 15 · 8 vCPU · 32 GB"
				description="Primary database cluster for the Atlas production tenant. Replicas are co-located in eu-west-1 and ap-southeast-2."
				actions={
					<>
						<Button variant="secondary" outline>
							Edit
						</Button>
						<Button>Deploy</Button>
					</>
				}
			/>
		</SectionCard>

		<SectionCard title="Color tokens">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<RichPageHeader
					icon={{ name: 'people', color: 'cyan' }}
					title="Team · Platform"
					sub="12 members · 3 leads"
				/>
				<RichPageHeader
					icon={{ name: 'graph-up', color: 'emerald' }}
					title="Revenue · Q2"
					sub="$4.2M closed"
				/>
				<RichPageHeader
					icon={{ name: 'flag', color: 'amber' }}
					title="Release · 2024.04"
					sub="Scheduled for 2024-04-18"
				/>
				<RichPageHeader
					icon={{ name: 'heart', color: 'pink' }}
					title="Wellbeing · April"
					sub="3 of 5 PTO days remaining"
				/>
				<RichPageHeader
					icon={{ name: 'cloud', color: 'blue' }}
					title="CDN · global"
					sub="42 edge PoPs online"
				/>
				<RichPageHeader
					icon={{ name: 'shield-lock', color: 'slate' }}
					title="Security · audit"
					sub="2 findings · 0 critical"
				/>
				<RichPageHeader
					icon={{ name: 'exclamation-triangle', color: 'rose' }}
					title="Incident · INC-482"
					sub="Mitigated · postmortem due"
				/>
			</div>
		</SectionCard>

		<SectionCard title="Just a title">
			<RichPageHeader title="Settings" />
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default RichPageHeaderDemo
