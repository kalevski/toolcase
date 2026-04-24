import React, { useState } from 'react'
import {
	Button,
	Chart,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const barData = [
	{ label: 'Jan', value: 4200 },
	{ label: 'Feb', value: 3800 },
	{ label: 'Mar', value: 5100 },
	{ label: 'Apr', value: 4700 },
	{ label: 'May', value: 6300 },
	{ label: 'Jun', value: 7100 },
]

const lineSeries = [
	{
		label: 'Revenue',
		data: [
			{ x: 'Jan', y: 4200 }, { x: 'Feb', y: 3800 }, { x: 'Mar', y: 5100 },
			{ x: 'Apr', y: 4700 }, { x: 'May', y: 6300 }, { x: 'Jun', y: 7100 },
		],
	},
	{
		label: 'Expenses',
		color: '#ef4444',
		data: [
			{ x: 'Jan', y: 2900 }, { x: 'Feb', y: 3100 }, { x: 'Mar', y: 3400 },
			{ x: 'Apr', y: 3200 }, { x: 'May', y: 3800 }, { x: 'Jun', y: 4000 },
		],
	},
]

const pieData = [
	{ label: 'Direct', value: 4200 },
	{ label: 'Organic', value: 3100 },
	{ label: 'Referral', value: 2200 },
	{ label: 'Social', value: 1400 },
	{ label: 'Email', value: 800 },
]

const heatmapData = (() => {
	const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
	const hours = ['9am', '11am', '1pm', '3pm', '5pm']
	const d = []
	for (const row of days) {
		for (const col of hours) {
			d.push({ row, col, value: Math.round(Math.random() * 100) })
		}
	}
	return d
})()

const funnelData = [
	{ label: 'Visitors', value: 12000 },
	{ label: 'Leads', value: 7800 },
	{ label: 'Qualified', value: 4200 },
	{ label: 'Proposals', value: 2100 },
	{ label: 'Closed', value: 840 },
]

const ganttTasks = [
	{ id: '1', label: 'Discovery', start: '2024-01-01', end: '2024-01-10', color: '#6366f1', progress: 100 },
	{ id: '2', label: 'Design', start: '2024-01-08', end: '2024-01-22', color: '#0ea5e9', progress: 80 },
	{ id: '3', label: 'Development', start: '2024-01-18', end: '2024-02-15', color: '#10b981', progress: 45 },
	{ id: '4', label: 'QA', start: '2024-02-10', end: '2024-02-24', color: '#f59e0b', progress: 0 },
	{ id: '5', label: 'Launch', start: '2024-02-25', end: '2024-02-28', color: '#ef4444', progress: 0 },
]

export const ChartDemo: React.FC = () => {
	const [containerLoading, setContainerLoading] = useState(false)

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="Chart"
				description="SVG-native chart components — bar, line, area, pie/donut, heatmap, funnel, gantt, sparkline, and trend indicator."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Trend Indicator">
				<div className="d-flex gap-3 flex-wrap align-items-center">
					<Chart chart={{ type: 'trend-indicator', value: 12.5 }} />
					<Chart chart={{ type: 'trend-indicator', value: -4.2 }} />
					<Chart chart={{ type: 'trend-indicator', value: 0 }} />
					<Chart chart={{ type: 'trend-indicator', value: '+ 18%', direction: 'up', size: 'large' }} />
					<Chart chart={{ type: 'trend-indicator', value: '- 7%', direction: 'down', size: 'small' }} />
				</div>
			</SectionCard>

			<SectionCard title="Sparkline">
				<div className="d-flex gap-4 flex-wrap align-items-center">
					<div>
						<div className="text-muted small mb-1">Line</div>
						<Chart chart={{ type: 'sparkline', data: [10, 22, 18, 35, 28, 42, 55, 48, 62, 70], color: '#6366f1' }} />
					</div>
					<div>
						<div className="text-muted small mb-1">Bar</div>
						<Chart chart={{ type: 'sparkline', data: [10, 22, 18, 35, 28, 42, 55, 48, 62, 70], sparklineType: 'bar', color: '#10b981' }} />
					</div>
					<div>
						<div className="text-muted small mb-1">Bar type larger</div>
						<Chart chart={{ type: 'sparkline', data: [10, 22, 18, 35, 28, 42, 55], sparklineType: 'bar', color: '#f59e0b', height: 48, width: 160 }} />
					</div>
				</div>
			</SectionCard>

			<SectionCard title="Bar Chart">
				<Chart chart={{ type: 'bar', data: barData, title: 'Monthly Revenue', subtitle: 'Jan – Jun 2024', showValues: true }} />
			</SectionCard>

			<SectionCard title="Horizontal Bar">
				<Chart chart={{ type: 'bar', data: barData.slice(0, 4), orientation: 'horizontal', title: 'Top Months' }} />
			</SectionCard>

			<SectionCard title="Line Chart">
				<Chart chart={{ type: 'line', series: lineSeries, title: 'Revenue vs Expenses', subtitle: 'Jan – Jun 2024' }} />
			</SectionCard>

			<SectionCard title="Area Chart">
				<Chart chart={{ type: 'area', series: lineSeries, title: 'Trend Overview' }} />
			</SectionCard>

			<SectionCard title="Pie Chart">
				<Chart chart={{ type: 'pie', data: pieData, title: 'Traffic Sources' }} />
			</SectionCard>

			<SectionCard title="Donut Chart">
				<Chart chart={{ type: 'pie', data: pieData, title: 'Traffic Sources', donut: true, centerLabel: 'Total' }} />
			</SectionCard>

			<SectionCard title="Heatmap">
				<Chart chart={{
					type: 'heatmap',
					data: heatmapData,
					rows: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
					cols: ['9am', '11am', '1pm', '3pm', '5pm'],
					title: 'Activity by Day & Hour',
				}} />
			</SectionCard>

			<SectionCard title="Funnel Chart">
				<Chart chart={{ type: 'funnel', data: funnelData, title: 'Sales Pipeline' }} />
			</SectionCard>

			<SectionCard title="Gantt Chart">
				<Chart chart={{ type: 'gantt', tasks: ganttTasks, title: 'Project Timeline' }} />
			</SectionCard>

			<SectionCard title="Chart Container">
				<div className="d-flex gap-2 mb-3">
					<Button size="small" variant="secondary" onClick={() => setContainerLoading(v => !v)}>
						Toggle Loading
					</Button>
				</div>
				<Chart chart={{ type: 'container', title: 'Analytics Overview', subtitle: 'Live data', loading: containerLoading }}>
					<div style={{ padding: '1rem 1.25rem' }}>
						<p className="text-muted mb-0">Chart content goes here when not loading.</p>
					</div>
				</Chart>
			</SectionCard>

			<SectionCard title="Empty State">
				<Chart chart={{ type: 'container', title: 'No Data', empty: true, emptySlot: <span>No records found</span> }} />
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
