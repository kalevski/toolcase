import React from 'react'
import {
	EntityProfileCard,
	Avatar,
	Badge,
	CodeSnippet,
	formatRelative,
} from '@toolcase/react-components'
import { DemoPage, DemoSection, DemoGrid } from './_demo'

const now = Date.now()

const EntityProfileCardDemo: React.FC = () => (
	<DemoPage
		eyebrow="Data Display"
		title="EntityProfileCard"
		lede={
			<>
				A profile card with a hero row (lead visual + identity block) and a responsive meta
				grid of <code>{'{'} icon, label, value, hint {'}'}</code> cells. Lead is a single slot
				— plug in an <code>Avatar</code>, an icon tile, or nothing.
			</>
		}
	>
		<DemoSection
			eyebrow="User profile"
			title="Avatar + chips + meta"
			caption="The flagship use: a user/member profile. Meta items render with an icon eyebrow, primary value, and optional hint."
		>
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
		</DemoSection>

		<DemoSection
			eyebrow="Subscription"
			title="Generic entity"
			caption="The same primitive covers subscriptions, licenses, or any other record with an identity + metadata shape."
		>
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
		</DemoSection>

		<DemoSection
			eyebrow="Loading"
			title="Skeleton state"
			caption="Set `loading` while fetching — both the hero and meta rows render as skeletons in place."
		>
			<DemoGrid columns={1} minItemWidth={320}>
				<EntityProfileCard title="" meta={[]} loading />
			</DemoGrid>
		</DemoSection>

		<DemoSection eyebrow="API" title="Usage">
			<CodeSnippet
				language="typescript"
				code={`import { EntityProfileCard, Avatar, Badge } from '@toolcase/react-components'

<EntityProfileCard
  lead={<Avatar name="Jordan Liu" size="large" />}
  title="Jordan Liu"
  subtitle="jordan@atlas.example.com"
  chips={<Badge variant="success" pill>Active</Badge>}
  meta={[
    { icon: 'calendar-event', label: 'Joined', value: '2023-08-12' },
    { icon: 'clock-history', label: 'Last seen', value: '3 hours ago' },
    { icon: 'hash', label: 'User ID', value: 'usr_9a82c0f3e641', mono: true },
  ]}
/>`}
			/>
		</DemoSection>
	</DemoPage>
)

export default EntityProfileCardDemo
