import React from 'react'
import {
	Avatar,
	Badge,
	EntityProfileCard,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	formatRelative
} from '@toolcase/react-components'

const now = Date.now()

const EntityProfileCardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="EntityProfileCard"
				description={
			<>
				A profile card with a hero row (lead visual + identity block) and a responsive meta
				grid of <code>{'{'} icon, label, value, hint {'}'}</code> cells. Lead is a single slot
				— plug in an <code>Avatar</code>, an icon tile, or nothing.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Avatar + chips + meta">
			<EntityProfileCard
				lead={<Avatar name="Jordan Liu" size="large" />}
				title="Jordan Liu"
				subtitle="jordan@atlas.example.com"
				chips={
					<>
						<Badge variant="success" pill>
							Active
						</Badge>
						<Badge variant="primary" pill>
							Admin
						</Badge>
					</>
				}
				meta={[
					{
						icon: 'calendar-event',
						label: 'Joined',
						value: '2023-08-12',
						hint: formatRelative(new Date(now - 600 * 86400 * 1000)),
					},
					{
						icon: 'clock-history',
						label: 'Last seen',
						value: formatRelative(new Date(now - 3 * 3600 * 1000)),
					},
					{
						icon: 'people',
						label: 'Teams',
						value: '3',
					},
					{
						icon: 'hash',
						label: 'User ID',
						value: 'usr_9a82c0f3e641',
						mono: true,
					},
				]}
			/>
		</SectionCard>

		<SectionCard title="Generic entity">
			<EntityProfileCard
				lead={<Avatar name="AC" variant="info" size="large" />}
				title="Atlas Cloud · Pro"
				subtitle="Annual plan · seat-based"
				chips={
					<>
						<Badge variant="info" pill>
							Pro
						</Badge>
						<Badge variant="warning" pill>
							Renews in 14d
						</Badge>
					</>
				}
				meta={[
					{ icon: 'credit-card', label: 'Plan', value: 'Pro · annual' },
					{ icon: 'calendar-event', label: 'Started', value: '2023-11-01' },
					{ icon: 'people', label: 'Seats', value: '24 of 50' },
					{ icon: 'hash', label: 'Subscription ID', value: 'sub_7b21', mono: true },
				]}
			/>
		</SectionCard>

		<SectionCard title="Skeleton state">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(1, minmax(0, 1fr))'}}>
				<EntityProfileCard title="" meta={[]} loading />
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default EntityProfileCardDemo
