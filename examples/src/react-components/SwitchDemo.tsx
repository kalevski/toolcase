import React, { useState } from 'react'
import { Switch } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const SwitchDemo: React.FC = () => {
	const [notifications, setNotifications] = useState(true)
	const [darkMode, setDarkMode] = useState(false)

	return (
		<DemoPage
			eyebrow="Inputs"
			title="Switch"
			lede="Toggle switch for on/off states with size variants and optional label."
		>
			<DemoSection title="Basic">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
			</DemoSection>

			<DemoSection title="Sizes">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Switch size="small" label="Small" defaultChecked />
					<Switch size="default" label="Default" defaultChecked />
					<Switch size="large" label="Large" defaultChecked />
				</div>
			</DemoSection>

			<DemoSection title="States">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Switch label="Checked" defaultChecked />
					<Switch label="Unchecked" />
					<Switch label="Disabled (on)" defaultChecked disabled />
					<Switch label="Disabled (off)" disabled />
				</div>
			</DemoSection>
		</DemoPage>
	)
}

export default SwitchDemo
