import React, { useState } from 'react'
import { Switch, Card, CodeSnippet } from '../../src'

const SwitchDemo: React.FC = () => {
	const [notifications, setNotifications] = useState(true)
	const [darkMode, setDarkMode] = useState(false)

	return (
		<div className="container my-5">
			<div className="row">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-4">Switch</h1>
					<p className="text-muted mb-5">
						Toggle switch for on/off states with size variants and optional label.
					</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">Basic</h2>
						<div className="d-flex flex-column gap-3">
							<Switch
								label="Enable notifications"
								checked={notifications}
								onChange={(e) => setNotifications(e.target.checked)}
							/>
							<Switch
								label="Dark mode"
								checked={darkMode}
								onChange={(e) => setDarkMode(e.target.checked)}
							/>
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">Sizes</h2>
						<div className="d-flex flex-column gap-3">
							<Switch size="small" label="Small" defaultChecked />
							<Switch size="default" label="Default" defaultChecked />
							<Switch size="large" label="Large" defaultChecked />
						</div>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h3 mb-4">States</h2>
						<div className="d-flex flex-column gap-3">
							<Switch label="Checked" defaultChecked />
							<Switch label="Unchecked" />
							<Switch label="Disabled (on)" defaultChecked disabled />
							<Switch label="Disabled (off)" disabled />
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
						code={`import { Switch } from '@webgame-cloud/react-components'

<Switch label="Enable notifications" checked={enabled} onChange={setEnabled} />`}
					/>
				</Card>
			</div>
		</div>
		</div>
	)
}

export default SwitchDemo
