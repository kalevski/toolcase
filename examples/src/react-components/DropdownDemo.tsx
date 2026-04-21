import React, { useState } from 'react'
import { Dropdown, Card, CodeSnippet } from '@toolcase/react-components'

const DropdownDemo: React.FC = () => {
	const [selected, setSelected] = useState('proj-1')
	const [selected2, setSelected2] = useState<string | undefined>(undefined)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">Dropdown</h1>
					<p className="text-muted mb-0">A custom dropdown selector with icon, name, and description per item.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Basic</h2>
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
					</Card>
				</div>
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">With Placeholder</h2>
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
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">With Disabled Items</h2>
						<Dropdown
							items={[
								{ key: 'free', name: 'Free', description: 'Basic features' },
								{ key: 'pro', name: 'Pro', description: 'All features' },
								{ key: 'enterprise', name: 'Enterprise', description: 'Coming soon', disabled: true },
							]}
							value="free"
							onChange={() => {}}
						/>
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-lg-6">
					<Card>
						<h2 className="h5 mb-3">Loading State</h2>
						<Dropdown
							items={[]}
							value={undefined}
							onChange={() => {}}
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
							code={`import { Dropdown } from '@toolcase/react-components'

<Dropdown
  items={[
    { key: 'edit', name: 'Edit', icon: 'pencil' },
    { key: 'delete', name: 'Delete', icon: 'trash' },
  ]}
  value={selected}
  onChange={setSelected}
  placeholder="Choose an action..."
/>`}
						/>
					</Card>
				</div>
			</div>
		</div>
	)
}

export default DropdownDemo
