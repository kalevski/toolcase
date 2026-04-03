import React, { useState } from 'react'
import { IconPicker, Card, CodeSnippet } from '@toolcase/react-components'

const ICON_OPTIONS = [
	{ icon: <i className="bi bi-house" />, label: 'Home', value: 'house' },
	{ icon: <i className="bi bi-gear" />, label: 'Settings', value: 'gear' },
	{ icon: <i className="bi bi-person" />, label: 'User', value: 'person' },
	{ icon: <i className="bi bi-star" />, label: 'Star', value: 'star' },
	{ icon: <i className="bi bi-heart" />, label: 'Heart', value: 'heart' },
	{ icon: <i className="bi bi-bell" />, label: 'Bell', value: 'bell' },
	{ icon: <i className="bi bi-bookmark" />, label: 'Bookmark', value: 'bookmark' },
	{ icon: <i className="bi bi-flag" />, label: 'Flag', value: 'flag' },
	{ icon: <i className="bi bi-camera" />, label: 'Camera', value: 'camera' },
	{ icon: <i className="bi bi-lightning" />, label: 'Lightning', value: 'lightning' },
	{ icon: <i className="bi bi-trophy" />, label: 'Trophy', value: 'trophy' },
	{ icon: <i className="bi bi-shield" />, label: 'Shield', value: 'shield' },
]

const IconPickerDemo: React.FC = () => {
	const [selected, setSelected] = useState('star')
	const [selected2, setSelected2] = useState('house')

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">IconPicker</h1>
					<p className="text-muted mb-0">A dropdown icon picker with configurable grid columns and selectable icon options.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Default (5 columns)</h2>
						<IconPicker
							label="Select Icon"
							icons={ICON_OPTIONS}
							value={selected}
							onChange={setSelected}
						/>
						<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {selected}</p>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">4 Columns</h2>
						<IconPicker
							label="Choose an Icon"
							icons={ICON_OPTIONS}
							value={selected2}
							onChange={setSelected2}
							columns={4}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">String Icons</h2>
						<IconPicker
							label="Simple Strings"
							icons={['🏠', '⚙️', '⭐', '❤️', '🔔', '🎮', '🚀', '🎨', '📦']}
							columns={3}
						/>
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
							code={`import { IconPicker } from '@webgame-cloud/react-components'

<IconPicker value={icon} onChange={setIcon} />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default IconPickerDemo
