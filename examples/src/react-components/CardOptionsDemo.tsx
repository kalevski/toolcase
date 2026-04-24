import React, { useState } from 'react'
import {
	CardOption,
	CardOptions,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const ENGINE_OPTIONS: CardOption[] = [
	{ key: 'phaser', icon: 'controller', title: 'Phaser', description: 'A fast, free, and fun open-source framework for Canvas and WebGL games.' },
	{ key: 'pixi', icon: 'gpu-card', title: 'PixiJS', description: 'The HTML5 creation engine for beautiful 2D experiences with lightning-fast rendering.' },
	{ key: 'custom', icon: 'code-slash', title: 'Custom', description: 'Start from scratch with your own engine or vanilla JavaScript/TypeScript.' },
]

const THEME_OPTIONS: CardOption[] = [
	{ key: 'fantasy', icon: 'stars', title: 'Fantasy', description: 'Medieval kingdoms, magic, mythical creatures and quests.' },
	{ key: 'sci-fi', icon: 'rocket-takeoff', title: 'Sci-Fi', description: 'Space exploration, futuristic technology and alien worlds.' },
	{ key: 'horror', icon: 'moon-stars', title: 'Horror', description: 'Dark atmospheres, suspense and supernatural elements.' },
	{ key: 'casual', icon: 'puzzle', title: 'Casual', description: 'Easy-to-learn mechanics, colorful graphics and relaxing play.' },
	{ key: 'retro', icon: 'joystick', title: 'Retro', description: 'Pixel art, chiptune sounds and classic arcade gameplay.' },
	{ key: 'strategy', icon: 'diagram-3', title: 'Strategy', description: 'Tactical decision-making, resource management and planning.' },
]

export default function CardOptionsDemo() {
	const [engine, setEngine] = useState<string | null>(null)
	const [theme, setTheme] = useState<string | null>(null)

	return (
		<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Inputs</RichPageHeaderChip>}
				title="CardOptions"
				description="A single-select card grid for choosing one option from a set, with icons, titles, and descriptions."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
			<SectionCard title="Game Engine (default columns)">
				<CardOptions options={ENGINE_OPTIONS} value={engine} onChange={setEngine} />
			</SectionCard>

			<SectionCard title="Theme (3 columns)">
				<CardOptions options={THEME_OPTIONS} value={theme} onChange={setTheme} columns={3} />
			</SectionCard>

			{(engine || theme) && (
				<SectionCard title="Selection">
					<p className="text-muted" style={{ fontSize: '0.85rem' }}>
						Selected: engine=<strong>{engine || '–'}</strong>, theme=<strong>{theme || '–'}</strong>
					</p>
				</SectionCard>
			)}
		</div>
		
			</div>
		</div>
	</div>
	)
}
