import React, { useState } from 'react'
import { MultiCardSelect, MultiCardSelectOption } from '../../src/MultiCardSelect'
import { Card, CodeSnippet } from '../../src'

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
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">MultiCardSelect</h1>
					<p className="text-muted mb-4">A multi-select card grid allowing users to toggle multiple options on and off.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Asset Categories (with descriptions)</h2>
						<MultiCardSelect options={CATEGORY_OPTIONS} value={categories} onChange={setCategories} />
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Features (3 columns, no descriptions)</h2>
						<MultiCardSelect options={FEATURE_OPTIONS} value={features} onChange={setFeatures} columns={3} />
					</Card>
				</div>
			</div>

			<div className="row">
				<div className="col-12">
					<p className="text-muted" style={{ fontSize: '0.85rem' }}>
						Categories: <strong>{categories.join(', ') || '–'}</strong>
						<br />
						Features: <strong>{features.join(', ') || '–'}</strong>
					</p>
				</div>
			</div>

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { MultiCardSelect } from '@webgame-cloud/react-components'

<MultiCardSelect
  options={[
    { key: 'sprites', title: 'Sprites', description: 'Player, enemies, items' },
    { key: 'audio', title: 'Audio', description: 'Music, sound effects' },
  ]}
  value={selected}
  onChange={setSelected}
/>`}
					/>
				</Card>
			</div>
		</div>
		</div>
	)
}
