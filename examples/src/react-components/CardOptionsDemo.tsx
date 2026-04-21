import React, { useState } from 'react'
import { CardOptions, CardOption } from '@toolcase/react-components'
import { Card, CodeSnippet } from '@toolcase/react-components'

const ENGINE_OPTIONS: CardOption[] = [
	{ key: 'phaser', icon: 'bi-controller', title: 'Phaser', description: 'A fast, free, and fun open-source framework for Canvas and WebGL games.' },
	{ key: 'pixi', icon: 'bi-gpu-card', title: 'PixiJS', description: 'The HTML5 creation engine for beautiful 2D experiences with lightning-fast rendering.' },
	{ key: 'custom', icon: 'bi-code-slash', title: 'Custom', description: 'Start from scratch with your own engine or vanilla JavaScript/TypeScript.' },
]

const THEME_OPTIONS: CardOption[] = [
	{ key: 'fantasy', icon: 'bi-stars', title: 'Fantasy', description: 'Medieval kingdoms, magic, mythical creatures and quests.' },
	{ key: 'sci-fi', icon: 'bi-rocket-takeoff', title: 'Sci-Fi', description: 'Space exploration, futuristic technology and alien worlds.' },
	{ key: 'horror', icon: 'bi-moon-stars', title: 'Horror', description: 'Dark atmospheres, suspense and supernatural elements.' },
	{ key: 'casual', icon: 'bi-puzzle', title: 'Casual', description: 'Easy-to-learn mechanics, colorful graphics and relaxing play.' },
	{ key: 'retro', icon: 'bi-joystick', title: 'Retro', description: 'Pixel art, chiptune sounds and classic arcade gameplay.' },
	{ key: 'strategy', icon: 'bi-diagram-3', title: 'Strategy', description: 'Tactical decision-making, resource management and planning.' },
]

export default function CardOptionsDemo() {
	const [engine, setEngine] = useState<string | null>(null)
	const [theme, setTheme] = useState<string | null>(null)

	return (
		<div className="container my-5">
			<div className="row mb-4">
				<div className="col-12">
					<h1 className="display-4 text-gradient-primary mb-2">CardOptions</h1>
					<p className="text-muted mb-4">A single-select card grid for choosing one option from a set, with icons, titles, and descriptions.</p>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Game Engine (default columns)</h2>
						<CardOptions options={ENGINE_OPTIONS} value={engine} onChange={setEngine} />
					</Card>
				</div>
			</div>

			<div className="row mb-5">
				<div className="col-12">
					<Card>
						<h2 className="h5 mb-3">Theme (3 columns)</h2>
						<CardOptions options={THEME_OPTIONS} value={theme} onChange={setTheme} columns={3} />
					</Card>
				</div>
			</div>

			{(engine || theme) && (
				<div className="row">
					<div className="col-12">
						<p className="text-muted" style={{ fontSize: '0.85rem' }}>
							Selected: engine=<strong>{engine || '–'}</strong>, theme=<strong>{theme || '–'}</strong>
						</p>
					</div>
				</div>
			)}

		{/* Usage */}
		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Usage</h2>
					<CodeSnippet
						language="typescript"
						code={`import { CardOptions } from '@toolcase/react-components'

<CardOptions
  options={[
    { key: 'option1', icon: 'bi-box', title: 'Basic', description: 'Free plan' },
    { key: 'option2', icon: 'bi-star', title: 'Pro', description: 'Full features' },
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
