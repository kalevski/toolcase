import React from 'react'
import {
	MetricGrid,
	MetricTile,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Skeleton
} from '@toolcase/react-components'

const MetricGridDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
				title="MetricGrid"
				description={
			<>
				A dense grid of read-only metric tiles. Lighter than <code>StatCard</code> — no card
				chrome, no trend chip. Use it when you want a compact read-out of related numbers, or as
				a secondary row below a <code>StatCard</code>.
			</>
		}
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Data-driven">
			<MetricGrid
				columns={4}
				items={[
					{ icon: 'hdd', label: 'Storage', value: '34.2', unit: 'GB', hint: '74% of quota' },
					{ icon: 'cloud-upload', label: 'Bundles', value: '342', hint: 'last 30 days' },
					{ icon: 'people', label: 'Seats', value: '12', unit: 'of 25' },
					{ icon: 'activity', label: 'Requests', value: '1.2M', hint: 'this month' },
				]}
			/>
		</SectionCard>

		<SectionCard title="Mixed content">
			<MetricGrid columns={3}>
				<MetricTile icon="server" label="Uptime" value="99.98" unit="%" />
				<MetricTile icon="lightning-charge" label="P95 latency" value="142" unit="ms" hint="last hour" />
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						gap: 6,
						padding: '0.75rem 0.875rem',
						border: '1px solid #e2e8f0',
						background: '#fff',
					}}
				>
					<Skeleton width="40%" />
					<Skeleton width="60%" height="1.25rem" />
				</div>
			</MetricGrid>
		</SectionCard>

		<SectionCard title="2 · 3 · 4">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
				<MetricGrid
					columns={2}
					items={[
						{ label: 'Inbound', value: '12.4', unit: 'GB/s' },
						{ label: 'Outbound', value: '8.1', unit: 'GB/s' },
					]}
				/>
				<MetricGrid
					columns={3}
					items={[
						{ label: 'CPU', value: '62', unit: '%' },
						{ label: 'Memory', value: '4.1', unit: 'GB' },
						{ label: 'Disk', value: '72', unit: '%' },
					]}
				/>
				<MetricGrid
					columns={4}
					items={[
						{ label: 'Reads', value: '2.1k' },
						{ label: 'Writes', value: '840' },
						{ label: 'Errors', value: '3' },
						{ label: 'Retries', value: '11' },
					]}
				/>
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default MetricGridDemo
