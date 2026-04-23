import React from 'react'
import { StatCard, CodeSnippet } from '@toolcase/react-components'
import { DemoPage, DemoSection, DemoGrid } from './_demo'

const StatCardDemo: React.FC = () => (
	<DemoPage
		eyebrow="Data Display"
		title="StatCard"
		lede={
			<>
				A KPI tile: a label, a large numeric <code>value</code> with optional <code>unit</code>,
				and a footer row with a delta chip, helper text, and a free-form <code>footer</code>{' '}
				slot. Purely presentational — data fetching and formatting live upstream.
			</>
		}
	>
		<DemoSection
			eyebrow="Default"
			title="Plain metric"
			caption="The minimum: a label and a value. Add an `icon` to anchor the eyebrow."
		>
			<DemoGrid columns={3} minItemWidth={220}>
				<StatCard label="Active users" value="12,480" />
				<StatCard icon="hdd" label="Storage used" value="34.2" unit="GB" />
				<StatCard icon="people" label="Teams" value="86" />
			</DemoGrid>
		</DemoSection>

		<DemoSection
			eyebrow="With delta"
			title="Up / down / neutral"
			caption="The delta chip accepts any string — usually a percentage change or a raw delta. Kind picks the color and arrow icon."
		>
			<DemoGrid columns={3} minItemWidth={220}>
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
			</DemoGrid>
		</DemoSection>

		<DemoSection
			eyebrow="Footer slot"
			title="Free-form footer"
			caption="Use the `footer` slot for supplementary info that doesn't fit the delta/helper pattern — a link, a tiny sparkline, a timestamp."
		>
			<DemoGrid columns={2} minItemWidth={260}>
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
			</DemoGrid>
		</DemoSection>

		<DemoSection
			eyebrow="Loading"
			title="Skeleton state"
			caption="Set `loading` while fetching — the layout stays stable and renders skeletons in place of each row."
		>
			<DemoGrid columns={3} minItemWidth={220}>
				<StatCard label="Active users" value="" loading />
				<StatCard label="Storage used" value="" loading />
				<StatCard label="Teams" value="" loading />
			</DemoGrid>
		</DemoSection>

		<DemoSection eyebrow="API" title="Usage">
			<CodeSnippet
				language="typescript"
				code={`import { StatCard } from '@toolcase/react-components'

<StatCard
  icon="graph-up-arrow"
  label="Revenue"
  value="$48.2k"
  delta="+12.4%"
  deltaKind="up"
  helper="vs. last month"
/>

<StatCard
  icon="hdd"
  label="Storage used"
  value="34.2"
  unit="GB"
/>`}
			/>
		</DemoSection>
	</DemoPage>
)

export default StatCardDemo
