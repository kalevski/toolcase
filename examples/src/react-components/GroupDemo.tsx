import React from 'react'
import {
	Group,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const GroupDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Layout & Surfaces</RichPageHeaderChip>}
				title="Group"
				description="A collapsible section with label, badge, and optional action button."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Default (Expanded)">
			<Group label="Sprites" badge="3">
				<div className="p-2">
					<p className="mb-1" style={{ fontSize: '0.85rem' }}>player.png</p>
					<p className="mb-1" style={{ fontSize: '0.85rem' }}>enemy.png</p>
					<p className="mb-0" style={{ fontSize: '0.85rem' }}>background.png</p>
				</div>
			</Group>
		</SectionCard>

		<SectionCard title="Collapsed by Default">
			<Group label="Audio Files" badge="5" defaultCollapsed>
				<div className="p-2">
					<p className="mb-1" style={{ fontSize: '0.85rem' }}>theme.mp3</p>
					<p className="mb-1" style={{ fontSize: '0.85rem' }}>click.wav</p>
					<p className="mb-0" style={{ fontSize: '0.85rem' }}>explosion.wav</p>
				</div>
			</Group>
		</SectionCard>

		<SectionCard title="With Action Button">
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
		</SectionCard>

		<SectionCard title="Without Badge">
			<Group label="Configuration">
				<div className="p-2">
					<p className="mb-0" style={{ fontSize: '0.85rem' }}>settings.json</p>
				</div>
			</Group>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default GroupDemo
