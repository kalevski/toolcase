import React from 'react'
import { StatusDot, Card, CodeSnippet } from '@toolcase/react-components'

const StatusDotDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-4">StatusDot</h1>
				<p className="text-muted mb-5">
					Colored indicator dot for online/offline/busy/away status with optional pulse and label.
				</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Statuses</h2>
					<div className="d-flex gap-4 flex-wrap align-items-center">
						<StatusDot status="online" label="Online" />
						<StatusDot status="offline" label="Offline" />
						<StatusDot status="busy" label="Busy" />
						<StatusDot status="away" label="Away" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Sizes</h2>
					<div className="d-flex gap-4 flex-wrap align-items-center">
						<StatusDot status="online" size="small" label="Small" />
						<StatusDot status="online" size="default" label="Default" />
						<StatusDot status="online" size="large" label="Large" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Pulse</h2>
					<div className="d-flex gap-4 flex-wrap align-items-center">
						<StatusDot status="online" pulse label="Online (pulsing)" />
						<StatusDot status="busy" pulse label="Busy (pulsing)" />
						<StatusDot status="away" pulse label="Away (pulsing)" />
					</div>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h3 mb-4">Without Label (dot only)</h2>
					<div className="d-flex gap-3 align-items-center">
						<StatusDot status="online" />
						<StatusDot status="offline" />
						<StatusDot status="busy" />
						<StatusDot status="away" />
					</div>
				</Card>
			</div>
		</div>

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { StatusDot } from '@toolcase/react-components'

<StatusDot status="online" />
<StatusDot status="offline" label="Server" />`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default StatusDotDemo
