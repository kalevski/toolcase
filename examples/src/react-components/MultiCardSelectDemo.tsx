import React, { useState } from 'react'
import { MultiCardSelect, MultiCardSelectOption } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

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
		<DemoPage
			eyebrow="Inputs"
			title="MultiCardSelect"
			lede="A multi-select card grid allowing users to toggle multiple options on and off."
		>
			<DemoSection title="Asset Categories (with descriptions)">
				<MultiCardSelect options={CATEGORY_OPTIONS} value={categories} onChange={setCategories} />
			</DemoSection>

			<DemoSection title="Features (3 columns, no descriptions)">
				<MultiCardSelect options={FEATURE_OPTIONS} value={features} onChange={setFeatures} columns={3} />
			</DemoSection>

			<DemoSection title="Selection state">
				<p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
					Categories: <strong>{categories.join(', ') || '–'}</strong>
					<br />
					Features: <strong>{features.join(', ') || '–'}</strong>
				</p>
			</DemoSection>
		</DemoPage>
	)
}
