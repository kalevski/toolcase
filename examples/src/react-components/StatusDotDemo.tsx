import React from 'react'
import { StatusDot } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const StatusDotDemo: React.FC = () => (
	<DemoPage
		eyebrow="Feedback"
		title="StatusDot"
		lede="Colored indicator dot for online/offline/busy/away status with optional pulse and label."
	>
		<DemoSection title="Statuses">
			<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
				<StatusDot status="online" label="Online" />
				<StatusDot status="offline" label="Offline" />
				<StatusDot status="busy" label="Busy" />
				<StatusDot status="away" label="Away" />
			</div>
		</DemoSection>

		<DemoSection title="Sizes">
			<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
				<StatusDot status="online" size="small" label="Small" />
				<StatusDot status="online" size="default" label="Default" />
				<StatusDot status="online" size="large" label="Large" />
			</div>
		</DemoSection>

		<DemoSection title="Pulse">
			<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
				<StatusDot status="online" pulse label="Online (pulsing)" />
				<StatusDot status="busy" pulse label="Busy (pulsing)" />
				<StatusDot status="away" pulse label="Away (pulsing)" />
			</div>
		</DemoSection>

		<DemoSection title="Without Label (dot only)">
			<div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
				<StatusDot status="online" />
				<StatusDot status="offline" />
				<StatusDot status="busy" />
				<StatusDot status="away" />
			</div>
		</DemoSection>
	</DemoPage>
)

export default StatusDotDemo
