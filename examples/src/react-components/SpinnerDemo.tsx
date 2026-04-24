import React from 'react'
import { Spinner } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const SpinnerDemo: React.FC = () => (
	<DemoPage
		eyebrow="Feedback"
		title="Spinner"
		lede="A loading indicator with variant colors, sizes, and optional label."
	>
		<DemoSection title="Variants">
			<div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
				<Spinner variant="primary" />
				<Spinner variant="secondary" />
				<Spinner variant="info" />
				<Spinner variant="success" />
				<Spinner variant="warning" />
				<Spinner variant="danger" />
			</div>
		</DemoSection>

		<DemoSection title="Sizes">
			<div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
				<Spinner size="small" />
				<Spinner size="default" />
				<Spinner size="large" />
			</div>
		</DemoSection>

		<DemoSection title="With Label">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
				<Spinner label="Loading data…" />
				<Spinner variant="success" label="Saving changes…" size="large" />
			</div>
		</DemoSection>
	</DemoPage>
)

export default SpinnerDemo
