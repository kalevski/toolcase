import React, { useState } from 'react'
import {
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Switch
} from '@toolcase/react-components'

const SwitchDemo: React.FC = () => {
	const [notifications, setNotifications] = useState(true)
	const [darkMode, setDarkMode] = useState(false)

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="Switch"
				description="Toggle switch for on/off states with size variants and optional label."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Basic">
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
			</SectionCard>

			<SectionCard title="Sizes">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Switch size="small" label="Small" defaultChecked />
					<Switch size="default" label="Default" defaultChecked />
					<Switch size="large" label="Large" defaultChecked />
				</div>
			</SectionCard>

			<SectionCard title="States">
				<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
					<Switch label="Checked" defaultChecked />
					<Switch label="Unchecked" />
					<Switch label="Disabled (on)" defaultChecked disabled />
					<Switch label="Disabled (off)" disabled />
				</div>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default SwitchDemo
