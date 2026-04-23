import React from 'react'
import { MetricGrid, MetricTile, Skeleton, CodeSnippet } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const MetricGridDemo: React.FC = () => (
	<DemoPage
		eyebrow="Data Display"
		title="MetricGrid"
		lede={
			<>
				A dense grid of read-only metric tiles. Lighter than <code>StatCard</code> — no card
				chrome, no trend chip. Use it when you want a compact read-out of related numbers, or as
				a secondary row below a <code>StatCard</code>.
			</>
		}
	>
		<DemoSection
			eyebrow="Items prop"
			title="Data-driven"
			caption="Pass an array of tile definitions via `items`. Columns default to 3 and collapse to 2 / 1 as the viewport narrows."
		>
			<MetricGrid
				columns={4}
				items={[
					{ icon: 'hdd', label: 'Storage', value: '34.2', unit: 'GB', hint: '74% of quota' },
					{ icon: 'cloud-upload', label: 'Bundles', value: '342', hint: 'last 30 days' },
					{ icon: 'people', label: 'Seats', value: '12', unit: 'of 25' },
					{ icon: 'activity', label: 'Requests', value: '1.2M', hint: 'this month' },
				]}
			/>
		</DemoSection>

		<DemoSection
			eyebrow="Children form"
			title="Mixed content"
			caption="When you need to mix plain tiles with loaders or custom nodes, pass children directly."
		>
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
		</DemoSection>

		<DemoSection
			eyebrow="Columns"
			title="2 · 3 · 4"
			caption="The `columns` prop hard-caps the grid. Tiles collapse to 2-up on tablet and 1-up on narrow phones automatically."
		>
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
		</DemoSection>

		<DemoSection eyebrow="API" title="Usage">
			<CodeSnippet
				language="typescript"
				code={`import { MetricGrid, MetricTile } from '@toolcase/react-components'

// Data-driven
<MetricGrid
  columns={4}
  items={[
    { icon: 'hdd', label: 'Storage', value: '34.2', unit: 'GB' },
    { icon: 'cloud-upload', label: 'Bundles', value: '342' },
    { icon: 'people', label: 'Seats', value: '12', unit: 'of 25' },
    { icon: 'activity', label: 'Requests', value: '1.2M' },
  ]}
/>

// Children form
<MetricGrid columns={3}>
  <MetricTile icon="server" label="Uptime" value="99.98" unit="%" />
  <MetricTile icon="lightning-charge" label="P95" value="142" unit="ms" />
</MetricGrid>`}
			/>
		</DemoSection>
	</DemoPage>
)

export default MetricGridDemo
