import React, { useState } from 'react'
import { ToggleCard, Card, Badge, CodeSnippet } from '../../src'

const ToggleCardDemo: React.FC = () => {
	const [notifications, setNotifications] = useState(true)
	const [darkMode, setDarkMode] = useState(false)
	const [analytics, setAnalytics] = useState(true)
	const [betaFeatures, setBetaFeatures] = useState(false)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">ToggleCard</h1>
					<p className="text-muted mb-0">A card-style toggle switch with icon, label, hint text, badge, and disabled state.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Basic Toggles</h2>
						<div className="d-flex flex-column gap-3">
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
					</Card>
				</div>

				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">With Badge</h2>
						<div className="d-flex flex-column gap-3">
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
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Disabled</h2>
						<div className="d-flex flex-column gap-3">
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
					</Card>
				</div>

				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">No Icon</h2>
						<div className="d-flex flex-column gap-3">
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
							code={`import { ToggleCard } from '@webgame-cloud/react-components'

<ToggleCard
  title="Email Notifications"
  description="Receive email alerts for important updates"
  checked={enabled}
  onChange={setEnabled}
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default ToggleCardDemo
