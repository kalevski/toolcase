import React, { useState } from 'react'
import { IconPicker, Card, CodeSnippet } from '@toolcase/react-components'

const ICON_OPTIONS = [
	{ icon: 'house', label: 'Home', value: 'house' },
	{ icon: 'gear', label: 'Settings', value: 'gear' },
	{ icon: 'person', label: 'User', value: 'person' },
	{ icon: 'star', label: 'Star', value: 'star' },
	{ icon: 'heart', label: 'Heart', value: 'heart' },
	{ icon: 'bell', label: 'Bell', value: 'bell' },
	{ icon: 'bookmark', label: 'Bookmark', value: 'bookmark' },
	{ icon: 'flag', label: 'Flag', value: 'flag' },
	{ icon: 'camera', label: 'Camera', value: 'camera' },
	{ icon: 'lightning', label: 'Lightning', value: 'lightning' },
	{ icon: 'trophy', label: 'Trophy', value: 'trophy' },
	{ icon: 'shield', label: 'Shield', value: 'shield' },
	{ icon: 'rocket-takeoff', label: 'Rocket', value: 'rocket-takeoff' },
	{ icon: 'envelope', label: 'Email', value: 'envelope' },
	{ icon: 'folder', label: 'Folder', value: 'folder' },
	{ icon: 'trash', label: 'Trash', value: 'trash' },
	{ icon: 'pencil', label: 'Edit', value: 'pencil' },
	{ icon: 'search', label: 'Search', value: 'search' },
	{ icon: 'grid', label: 'Grid', value: 'grid' },
	{ icon: 'bar-chart', label: 'Chart', value: 'bar-chart' },
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
						<h2 className="h5 mb-3">String Array</h2>
						<IconPicker
							label="Simple Strings"
							icons={['house', 'gear', 'star', 'heart', 'bell', 'rocket-takeoff', 'envelope', 'folder', 'trash']}
							columns={3}
						/>
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Loading State</h2>
						<IconPicker
							label="Loading..."
							icons={ICON_OPTIONS}
							loading
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
							code={`import { IconPicker } from '@toolcase/react-components'

const icons = [
  { icon: 'house', label: 'Home', value: 'house' },
  { icon: 'gear', label: 'Settings', value: 'gear' },
  { icon: 'star', label: 'Star', value: 'star' },
]

<IconPicker label="Select Icon" icons={icons} value={icon} onChange={setIcon} />
<IconPicker label="Loading" icons={icons} loading />`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default IconPickerDemo
