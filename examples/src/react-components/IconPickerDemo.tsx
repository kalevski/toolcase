import React, { useState } from 'react'
import { IconPicker } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

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
		<DemoPage
			eyebrow="Inputs"
			title="IconPicker"
			lede="A dropdown icon picker with configurable grid columns and selectable icon options."
		>
			<DemoSection title="Default (5 columns)">
				<IconPicker
					label="Select Icon"
					icons={ICON_OPTIONS}
					value={selected}
					onChange={setSelected}
				/>
				<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {selected}</p>
			</DemoSection>

			<DemoSection title="4 Columns">
				<IconPicker
					label="Choose an Icon"
					icons={ICON_OPTIONS}
					value={selected2}
					onChange={setSelected2}
					columns={4}
				/>
			</DemoSection>

			<DemoSection title="String Array">
				<IconPicker
					label="Simple Strings"
					icons={['house', 'gear', 'star', 'heart', 'bell', 'rocket-takeoff', 'envelope', 'folder', 'trash']}
					columns={3}
				/>
			</DemoSection>

			<DemoSection title="Loading State">
				<IconPicker
					label="Loading..."
					icons={ICON_OPTIONS}
					loading
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default IconPickerDemo
