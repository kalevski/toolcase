import React, { useState } from 'react'
import { Chart, Card, CodeSnippet, Button } from '@toolcase/react-components'

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Chart</h1>
					<p className="text-muted mb-0">SVG-native chart components — bar, line, area, pie/donut, heatmap, funnel, gantt, sparkline, and trend indicator.</p>
				</div>
			</div>

			{/* TrendIndicator */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Trend Indicator</h2>
						<div className="d-flex gap-3 flex-wrap align-items-center">
							<Chart chart={{ type: 'trend-indicator', value: 12.5 }} />
							<Chart chart={{ type: 'trend-indicator', value: -4.2 }} />
							<Chart chart={{ type: 'trend-indicator', value: 0 }} />
							<Chart chart={{ type: 'trend-indicator', value: '+ 18%', direction: 'up', size: 'large' }} />
							<Chart chart={{ type: 'trend-indicator', value: '- 7%', direction: 'down', size: 'small' }} />
						</div>
					</Card>
				</div>
			</div>

			{/* Sparkline */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Sparkline</h2>
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
					</Card>
				</div>
			</div>

			{/* Bar Chart */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Bar Chart</h2>
						<Chart chart={{ type: 'bar', data: barData, title: 'Monthly Revenue', subtitle: 'Jan – Jun 2024', showValues: true }} />
					</Card>
				</div>
				<div className="col-lg-4">
					<Card>
						<h2 className="h5 mb-3">Horizontal</h2>
						<Chart chart={{ type: 'bar', data: barData.slice(0, 4), orientation: 'horizontal', title: 'Top Months' }} />
					</Card>
				</div>
			</div>

			{/* Line Chart */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Line Chart</h2>
						<Chart chart={{ type: 'line', series: lineSeries, title: 'Revenue vs Expenses', subtitle: 'Jan – Jun 2024' }} />
					</Card>
				</div>
				<div className="col-lg-4">
					<Card>
						<h2 className="h5 mb-3">Area Chart</h2>
						<Chart chart={{ type: 'area', series: lineSeries, title: 'Trend Overview' }} />
					</Card>
				</div>
			</div>

			{/* Pie / Donut */}
			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Pie Chart</h2>
						<Chart chart={{ type: 'pie', data: pieData, title: 'Traffic Sources' }} />
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Donut Chart</h2>
						<Chart chart={{ type: 'pie', data: pieData, title: 'Traffic Sources', donut: true, centerLabel: 'Total' }} />
					</Card>
				</div>
			</div>

			{/* Heatmap */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Heatmap</h2>
						<Chart chart={{
							type: 'heatmap',
							data: heatmapData,
							rows: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
							cols: ['9am', '11am', '1pm', '3pm', '5pm'],
							title: 'Activity by Day & Hour',
						}} />
					</Card>
				</div>
			</div>

			{/* Funnel Chart */}
			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Funnel Chart</h2>
						<Chart chart={{ type: 'funnel', data: funnelData, title: 'Sales Pipeline' }} />
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Gantt Chart</h2>
						<Chart chart={{ type: 'gantt', tasks: ganttTasks, title: 'Project Timeline' }} />
					</Card>
				</div>
			</div>

			{/* ChartContainer */}
			<div className="row mb-5">
				<div className="col-lg-8">
					<Card>
						<h2 className="h5 mb-3">Chart Container</h2>
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
					</Card>
				</div>
				<div className="col-lg-4">
					<Card>
						<h2 className="h5 mb-3">Empty State</h2>
						<Chart chart={{ type: 'container', title: 'No Data', empty: true, emptySlot: <span>No records found</span> }} />
					</Card>
				</div>
			</div>

			{/* Code Usage */}
			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Usage</h2>
						<CodeSnippet language="typescript" code={`import { Chart } from '@toolcase/react-components'

// Bar chart
<Chart chart={{ type: 'bar', data: [{ label: 'Jan', value: 4200 }], title: 'Revenue' }} />

// Line chart
<Chart chart={{ type: 'line', series: [{ label: 'Revenue', data: [{ x: 'Jan', y: 4200 }] }] }} />

// Donut chart
<Chart chart={{ type: 'pie', data: [...], donut: true, centerLabel: 'Total' }} />

// Trend indicator
<Chart chart={{ type: 'trend-indicator', value: 12.5 }} />

// Sparkline
<Chart chart={{ type: 'sparkline', data: [10, 22, 35, 28, 42] }} />

// Chart container with loading
<Chart chart={{ type: 'container', title: 'Overview', loading: true }}>
  <BarChart ... />
</Chart>`} />
					</Card>
				</div>
			</div>
		</div>
	)
}
