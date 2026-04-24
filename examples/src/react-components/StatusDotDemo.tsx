import React from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	StatusDot
} from '@toolcase/react-components'

const StatusDotDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Feedback</RichPageHeaderChip>}
				title="StatusDot"
				description="Colored indicator dot for online/offline/busy/away status with optional pulse and label."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Statuses">
			<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
				<StatusDot status="online" label="Online" />
				<StatusDot status="offline" label="Offline" />
				<StatusDot status="busy" label="Busy" />
				<StatusDot status="away" label="Away" />
			</div>
		</SectionCard>

		<SectionCard title="Sizes">
			<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
				<StatusDot status="online" size="small" label="Small" />
				<StatusDot status="online" size="default" label="Default" />
				<StatusDot status="online" size="large" label="Large" />
			</div>
		</SectionCard>

		<SectionCard title="Pulse">
			<div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
				<StatusDot status="online" pulse label="Online (pulsing)" />
				<StatusDot status="busy" pulse label="Busy (pulsing)" />
				<StatusDot status="away" pulse label="Away (pulsing)" />
			</div>
		</SectionCard>

		<SectionCard title="Without Label (dot only)">
			<div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
				<StatusDot status="online" />
				<StatusDot status="offline" />
				<StatusDot status="busy" />
				<StatusDot status="away" />
			</div>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default StatusDotDemo
