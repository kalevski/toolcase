import React from 'react'
import { Group } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const GroupDemo: React.FC = () => (
	<DemoPage
		eyebrow="Layout & Surfaces"
		title="Group"
		lede="A collapsible section with label, badge, and optional action button."
	>
		<DemoSection title="Default (Expanded)">
			<Group label="Sprites" badge="3">
				<div className="p-2">
					<p className="mb-1" style={{ fontSize: '0.85rem' }}>player.png</p>
					<p className="mb-1" style={{ fontSize: '0.85rem' }}>enemy.png</p>
					<p className="mb-0" style={{ fontSize: '0.85rem' }}>background.png</p>
				</div>
			</Group>
		</DemoSection>

		<DemoSection title="Collapsed by Default">
			<Group label="Audio Files" badge="5" defaultCollapsed>
				<div className="p-2">
					<p className="mb-1" style={{ fontSize: '0.85rem' }}>theme.mp3</p>
					<p className="mb-1" style={{ fontSize: '0.85rem' }}>click.wav</p>
					<p className="mb-0" style={{ fontSize: '0.85rem' }}>explosion.wav</p>
				</div>
			</Group>
		</DemoSection>

		<DemoSection title="With Action Button">
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
		</DemoSection>

		<DemoSection title="Without Badge">
			<Group label="Configuration">
				<div className="p-2">
					<p className="mb-0" style={{ fontSize: '0.85rem' }}>settings.json</p>
				</div>
			</Group>
		</DemoSection>
	</DemoPage>
)

export default GroupDemo
