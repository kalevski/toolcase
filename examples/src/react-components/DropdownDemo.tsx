import React, { useState } from 'react'
import { Dropdown } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const DropdownDemo: React.FC = () => {
	const [selected, setSelected] = useState('proj-1')
	const [selected2, setSelected2] = useState<string | undefined>(undefined)

	return (
		<DemoPage
			eyebrow="Buttons & Actions"
			title="Dropdown"
			lede="A custom dropdown selector with icon, name, and description per item."
		>
			<DemoSection title="Basic">
				<Dropdown
					items={[
						{ key: 'proj-1', name: 'Space Invaders', description: 'Arcade shooter', icon: 'rocket-takeoff' },
						{ key: 'proj-2', name: 'Puzzle Quest', description: 'Match-3 RPG', icon: 'puzzle' },
						{ key: 'proj-3', name: 'Pixel Runner', description: 'Platformer', icon: 'controller' },
						{ key: 'proj-4', name: 'Strategy Master', description: 'Real-time strategy', icon: 'chess' },
						{ key: 'proj-5', name: 'Adventure Land', description: 'Open-world adventure', icon: 'map' },
						{ key: 'proj-6', name: 'Mystery Manor', description: 'Hidden object game', icon: 'house' },
						{ key: 'proj-7', name: 'Racing Thunder', description: 'Arcade racing', icon: 'car-front' },
						{ key: 'proj-8', name: 'Fantasy Quest', description: 'Fantasy RPG', icon: 'sword' },
						{ key: 'proj-9', name: 'Sci-Fi Shooter', description: 'First-person shooter', icon: 'laser-gun' },
						{ key: 'proj-10', name: 'Sports Pro', description: 'Sports simulation', icon: 'trophy' },
					]}
					value={selected}
					onChange={setSelected}
				/>
				<p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>Selected: {selected}</p>
			</DemoSection>

			<DemoSection title="With Placeholder">
				<Dropdown
					items={[
						{ key: 'unity', name: 'Unity', icon: 'box' },
						{ key: 'godot', name: 'Godot', icon: 'gem' },
						{ key: 'unreal', name: 'Unreal Engine', icon: 'gpu-card' },
					]}
					value={selected2}
					onChange={setSelected2}
					placeholder="Choose an engine..."
				/>
			</DemoSection>

			<DemoSection title="With Disabled Items">
				<Dropdown
					items={[
						{ key: 'free', name: 'Free', description: 'Basic features' },
						{ key: 'pro', name: 'Pro', description: 'All features' },
						{ key: 'enterprise', name: 'Enterprise', description: 'Coming soon', disabled: true },
					]}
					value="free"
					onChange={() => {}}
				/>
			</DemoSection>

			<DemoSection title="Loading State">
				<Dropdown
					items={[]}
					value={undefined}
					onChange={() => {}}
					loading
				/>
			</DemoSection>
		</DemoPage>
	)
}

export default DropdownDemo
