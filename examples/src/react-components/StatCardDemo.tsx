import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	StatCard
} from '@toolcase/react-components'

const StatCardDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="StatCard"
				description={
			<>
				A KPI tile: a label, a large numeric <code>value</code> with optional <code>unit</code>,
				and a footer row with a delta chip, helper text, and a free-form <code>footer</code>{' '}
				slot. Purely presentational — data fetching and formatting live upstream.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Plain metric">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'}}>
				<StatCard label="Active users" value="12,480" />
				<StatCard icon="hdd" label="Storage used" value="34.2" unit="GB" />
				<StatCard icon="people" label="Teams" value="86" />
			</div>
		</SectionCard>

		<SectionCard title="Up / down / neutral">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'}}>
				<StatCard
					icon="graph-up-arrow"
					label="Revenue"
					value="$48.2k"
					delta="+12.4%"
					deltaKind="up"
					helper="vs. last month"
				/>
				<StatCard
					icon="graph-down-arrow"
					label="Churn"
					value="2.1"
					unit="%"
					delta="-0.3pp"
					deltaKind="down"
					helper="vs. last month"
				/>
				<StatCard
					icon="activity"
					label="Sessions"
					value="1,204"
					delta="±0"
					deltaKind="neutral"
					helper="flat week-on-week"
				/>
			</div>
		</SectionCard>

		<SectionCard title="Free-form footer">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'}}>
				<StatCard
					icon="cloud-upload"
					label="Bundles shipped"
					value="342"
					delta="+18"
					deltaKind="up"
					footer={<span style={{ fontSize: '0.78rem' }}>last 30 days</span>}
				/>
				<StatCard
					icon="cpu"
					label="Compute hours"
					value="1,940"
					unit="hrs"
					helper="74% of monthly quota"
				/>
			</div>
		</SectionCard>

		<SectionCard title="Skeleton state">
			<div style={{display: 'grid', gap: 16, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'}}>
				<StatCard label="Active users" value="" loading />
				<StatCard label="Storage used" value="" loading />
				<StatCard label="Teams" value="" loading />
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default StatCardDemo
