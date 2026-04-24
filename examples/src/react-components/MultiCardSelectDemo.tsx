import React, { useState } from 'react'
import {
	MultiCardSelect,
	MultiCardSelectOption,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const CATEGORY_OPTIONS: MultiCardSelectOption[] = [
	{ key: 'sprites', title: 'Sprites', description: 'Player, enemies, items, NPCs' },
	{ key: 'tilesets', title: 'Tilesets', description: 'Ground, walls, platforms' },
	{ key: 'ui', title: 'UI', description: 'Buttons, panels, icons, HUD' },
	{ key: 'audio', title: 'Audio', description: 'Music, sound effects, ambient' },
	{ key: 'backgrounds', title: 'Backgrounds', description: 'Parallax layers, sky, scenery' },
	{ key: 'animations', title: 'Animations', description: 'Sprite sheets, skeletal rigs' },
	{ key: 'fonts', title: 'Fonts', description: 'Bitmap fonts, TTFs' },
	{ key: 'data', title: 'Data', description: 'JSON configs, level maps, dialogues' },
]

const FEATURE_OPTIONS: MultiCardSelectOption[] = [
	{ key: 'auth', title: 'Authentication' },
	{ key: 'db', title: 'Database' },
	{ key: 'storage', title: 'File Storage' },
	{ key: 'realtime', title: 'Realtime Sync' },
	{ key: 'analytics', title: 'Analytics' },
	{ key: 'ci', title: 'CI/CD Pipeline' },
]

export default function MultiCardSelectDemo() {
	const [categories, setCategories] = useState<string[]>(['sprites', 'audio'])
	const [features, setFeatures] = useState<string[]>([])

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="MultiCardSelect"
				description="A multi-select card grid allowing users to toggle multiple options on and off."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Asset Categories (with descriptions)">
				<MultiCardSelect options={CATEGORY_OPTIONS} value={categories} onChange={setCategories} />
			</SectionCard>

			<SectionCard title="Features (3 columns, no descriptions)">
				<MultiCardSelect options={FEATURE_OPTIONS} value={features} onChange={setFeatures} columns={3} />
			</SectionCard>

			<SectionCard title="Selection state">
				<p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
					Categories: <strong>{categories.join(', ') || '–'}</strong>
					<br />
					Features: <strong>{features.join(', ') || '–'}</strong>
				</p>
			</SectionCard>
		</div>
		
			</div>
		</div>
	</div>
	)
}
