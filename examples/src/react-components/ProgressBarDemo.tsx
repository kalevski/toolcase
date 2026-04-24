import React from 'react'
import { ProgressBar } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const ProgressBarDemo: React.FC = () => (
	<DemoPage
		eyebrow="Feedback"
		title="ProgressBar"
		lede="A horizontal progress bar with optional label, variant, and custom height."
	>
		<DemoSection title="Variants">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<ProgressBar value={70} variant="primary" label="Primary" />
				<ProgressBar value={55} variant="secondary" label="Secondary" />
				<ProgressBar value={90} variant="success" label="Success" />
				<ProgressBar value={30} variant="danger" label="Danger" />
				<ProgressBar value={45} variant="warning" label="Warning" />
				<ProgressBar value={60} variant="info" label="Info" />
			</div>
		</DemoSection>

		<DemoSection title="Different Values">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<ProgressBar value={0} label="0%" />
				<ProgressBar value={25} label="25%" />
				<ProgressBar value={50} label="50%" />
				<ProgressBar value={75} label="75%" />
				<ProgressBar value={100} label="100%" variant="success" />
			</div>
		</DemoSection>

		<DemoSection title="Custom Height">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<ProgressBar value={60} variant="primary" label="Thin (4px)" height={4} />
				<ProgressBar value={60} variant="primary" label="Default" />
				<ProgressBar value={60} variant="primary" label="Thick (20px)" height={20} />
			</div>
		</DemoSection>

		<DemoSection title="Indeterminate">
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				<ProgressBar indeterminate variant="primary" label="Uploading..." />
				<ProgressBar indeterminate variant="info" label="Processing..." />
				<ProgressBar indeterminate variant="success" label="Saving..." />
			</div>
		</DemoSection>
	</DemoPage>
)

export default ProgressBarDemo
