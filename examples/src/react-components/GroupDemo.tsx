import React from 'react'
import { Group, Card, CodeSnippet } from '@toolcase/react-components'

const GroupDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Group</h1>
				<p className="text-muted mb-0">A collapsible section with label, badge, and optional action button.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Default (Expanded)</h2>
					<Group label="Sprites" badge="3">
						<div className="p-2">
							<p className="mb-1" style={{ fontSize: '0.85rem' }}>player.png</p>
							<p className="mb-1" style={{ fontSize: '0.85rem' }}>enemy.png</p>
							<p className="mb-0" style={{ fontSize: '0.85rem' }}>background.png</p>
						</div>
					</Group>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Collapsed by Default</h2>
					<Group label="Audio Files" badge="5" defaultCollapsed>
						<div className="p-2">
							<p className="mb-1" style={{ fontSize: '0.85rem' }}>theme.mp3</p>
							<p className="mb-1" style={{ fontSize: '0.85rem' }}>click.wav</p>
							<p className="mb-0" style={{ fontSize: '0.85rem' }}>explosion.wav</p>
						</div>
					</Group>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">With Action Button</h2>
					<Group
						label="Scenes"
						badge="2"
						onActionClick={() => alert('Add scene clicked')}
						actionLabel="Add Scene"
						actionIcon="plus-lg"
					>
						<div className="p-2">
							<p className="mb-1" style={{ fontSize: '0.85rem' }}>MainMenu.scene</p>
							<p className="mb-0" style={{ fontSize: '0.85rem' }}>Level1.scene</p>
						</div>
					</Group>
				</Card>
			</div>
			<div className="col-lg-6">
				<Card>
					<h2 className="h5 mb-3">Without Badge</h2>
					<Group label="Configuration">
						<div className="p-2">
							<p className="mb-0" style={{ fontSize: '0.85rem' }}>settings.json</p>
						</div>
					</Group>
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
						code={`import { Group } from '@webgame-cloud/react-components'

<Group label="Sprites" badge="3" defaultCollapsed>
  <p>Group content goes here</p>
</Group>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default GroupDemo
