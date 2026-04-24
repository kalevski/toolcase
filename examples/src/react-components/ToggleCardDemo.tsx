import React, { useState } from 'react'
import {
	Badge,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	ToggleCard
} from '@toolcase/react-components'

const ToggleCardDemo: React.FC = () => {
	const [notifications, setNotifications] = useState(true)
	const [darkMode, setDarkMode] = useState(false)
	const [analytics, setAnalytics] = useState(true)
	const [betaFeatures, setBetaFeatures] = useState(false)

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="ToggleCard"
				description="A card-style toggle switch with icon, label, hint text, badge, and disabled state."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Basic Toggles">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<ToggleCard
						label="Notifications"
						hint="Receive email and push notifications"
						icon="bi-bell"
						checked={notifications}
						onChange={setNotifications}
					/>
					<ToggleCard
						label="Dark Mode"
						hint="Use dark theme across the app"
						icon="bi-moon"
						checked={darkMode}
						onChange={setDarkMode}
					/>
					<ToggleCard
						label="Analytics"
						hint="Collect anonymous usage data"
						icon="bi-graph-up"
						checked={analytics}
						onChange={setAnalytics}
					/>
				</div>
			</SectionCard>

			<SectionCard title="With Badge">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<ToggleCard
						label="Beta Features"
						hint="Try experimental features before release"
						icon="bi-rocket-takeoff"
						badge={<Badge variant="warning">Beta</Badge>}
						checked={betaFeatures}
						onChange={setBetaFeatures}
					/>
					<ToggleCard
						label="Premium Support"
						hint="Priority support channel access"
						icon="bi-star"
						badge={<Badge variant="info">Pro</Badge>}
						checked={true}
						onChange={() => {}}
					/>
				</div>
			</SectionCard>

			<SectionCard title="Disabled">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<ToggleCard
						label="Two-Factor Auth"
						hint="This setting is managed by your organization"
						icon="bi-shield-lock"
						checked={true}
						disabled
					/>
					<ToggleCard
						label="API Access"
						hint="Requires a paid plan to enable"
						icon="bi-key"
						checked={false}
						disabled
					/>
				</div>
			</SectionCard>

			<SectionCard title="No Icon">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<ToggleCard
						label="Auto-save"
						hint="Save changes automatically every 30 seconds"
						checked={true}
						onChange={() => {}}
					/>
					<ToggleCard
						label="Show line numbers"
						checked={false}
						onChange={() => {}}
					/>
				</div>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default ToggleCardDemo
