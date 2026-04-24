import React, { useState } from 'react'
import {
	IconPicker,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

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
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="IconPicker"
				description="A dropdown icon picker with configurable grid columns and selectable icon options."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Default (5 columns)">
				<IconPicker
					label="Select Icon"
					icons={ICON_OPTIONS}
					value={selected}
					onChange={setSelected}
				/>
				<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {selected}</p>
			</SectionCard>

			<SectionCard title="4 Columns">
				<IconPicker
					label="Choose an Icon"
					icons={ICON_OPTIONS}
					value={selected2}
					onChange={setSelected2}
					columns={4}
				/>
			</SectionCard>

			<SectionCard title="String Array">
				<IconPicker
					label="Simple Strings"
					icons={['house', 'gear', 'star', 'heart', 'bell', 'rocket-takeoff', 'envelope', 'folder', 'trash']}
					columns={3}
				/>
			</SectionCard>

			<SectionCard title="Loading State">
				<IconPicker
					label="Loading..."
					icons={ICON_OPTIONS}
					loading
				/>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}

export default IconPickerDemo
