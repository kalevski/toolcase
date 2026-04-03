import React from 'react'
import { DashboardCard, Card, CodeSnippet } from '@toolcase/react-components'
import type { DashboardCardProps } from '@toolcase/react-components'

const cards: DashboardCardProps[] = [
	{
		type: 'basic',
		textA: 'GOOD MORNING',
		textB: 'Daniel',
		icon: 'sun',
	},
	{
		type: 'basic',
		textA: 'LAST LOGIN',
		textB: '2 hours ago',
		icon: 'clock',
	},
	{
		type: 'difference',
		title: 'Game Players',
		value: 4000,
		previousValue: 2000,
		period: 'week',
	},
	{
		type: 'difference',
		title: 'Revenue',
		value: 8400,
		previousValue: 9200,
		period: 'month',
	},
	{
		type: 'difference',
		title: 'Avg. Session',
		value: 32,
		previousValue: 32,
		period: 'day',
		formatValue: (v) => `${v}m`,
	},
	{
		type: 'metric',
		title: 'Bandwidth',
		value: '142 GB',
		subtitle: 'Last 30 days',
		icon: 'speedometer2',
		trend: [20, 35, 28, 42, 55, 48, 62, 70, 65, 80, 95, 88, 100, 110, 142],
		trendColor: '#6366f1',
	},
	{
		type: 'metric',
		title: 'Error Rate',
		value: '0.12%',
		subtitle: 'Below threshold',
		icon: 'bug',
		trend: [5, 3, 6, 2, 4, 1, 3, 2, 1, 2, 1, 1],
		trendColor: '#22c55e',
	},
	{
		type: 'slices',
		title: 'Player Distribution',
		slices: [
			{ value: 420, text: 'Mobile' },
			{ value: 280, text: 'Desktop' },
			{ value: 150, text: 'Console' },
			{ value: 50, text: 'Other' },
		],
	},
	{
		type: 'list',
		title: 'Top Games',
		ordered: true,
		items: [
			{ label: 'Space Drift', value: '12.4K', icon: 'rocket-takeoff', color: '#6366f1' },
			{ label: 'Pixel Quest', value: '8.2K', icon: 'joystick', color: '#f59e0b' },
			{ label: 'Tower Rush', value: '6.1K', icon: 'building', color: '#22c55e' },
			{ label: 'Ocean Saga', value: '3.8K', icon: 'water', color: '#06b6d4' },
			{ label: 'Dungeon Run', value: '2.5K', icon: 'door-open', color: '#ec4899' },
		],
	},
	{
		type: 'status',
		title: 'System Health',
		items: [
			{ label: 'API Gateway', status: 'ok', detail: '28ms' },
			{ label: 'Database', status: 'ok', detail: '12ms' },
			{ label: 'CDN', status: 'warning', detail: 'High latency' },
			{ label: 'Worker Queue', status: 'error', detail: 'Down' },
			{ label: 'Backup Service', status: 'inactive', detail: 'Scheduled' },
		],
	},
	{
		type: 'activity',
		title: 'Recent Activity',
		activities: [
			{ icon: 'cloud-upload', title: 'Build deployed', description: 'v2.4.1 pushed to production', username: 'danielk', time: '5m ago' },
			{ icon: 'person-plus', title: 'New team member', description: 'Joined as Developer', username: 'admin', time: '1h ago' },
			{ icon: 'gear', title: 'Settings updated', description: 'Changed CDN region to EU-West', username: 'danielk', time: '3h ago' },
			{ icon: 'flag', title: 'Milestone reached', description: '10K monthly active players', time: 'Yesterday' },
		],
	},
	{
		type: 'colored',
		text: 'Files Uploaded',
		value: 128,
		icon: 'cloud-upload',
		color: '#6366f1',
	}
]

const DashboardCardDemo = () => {
	return (
		<div className="container py-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">DashboardCard</h1>
					<p className="text-muted mb-4">A versatile card component supporting basic, difference, metric, slices, list, status, activity, and colored variants for dashboard layouts.</p>
				</div>
			</div>
			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
				{cards.map((card, i) => (
					<DashboardCard onClick={() => console.log('clicked', card.type)} key={i} card={card} />
				))}
			</div>

			{/* Usage */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet
							language="typescript"
							code={`import { DashboardCard } from '@webgame-cloud/react-components'
import type { DashboardCardProps } from '@webgame-cloud/react-components'

const card: DashboardCardProps = {
  type: 'difference',
  title: 'Revenue',
  value: 8400,
  previousValue: 6200,
  period: 'month',
}

<DashboardCard card={card} onClick={() => console.log('clicked')} />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default DashboardCardDemo
