import { useNavigate } from 'react-router'
import { Badge, Button, Heading, Icon, SectionCard, Text } from '@toolcase/react-components'
import { gameComponentExamples, categories, GameComponentCategory } from '../game-components/index'

const categoryIcons: Record<GameComponentCategory, string> = {
	'Basic Components': 'cube',
	'Layout Primitives': 'grid-3x3',
	'Surfaces': 'square',
	'Typography': 'type',
	'Visual Indicators & Badges': 'gem',
	'Buttons & Navigation': 'mouse',
	'Lists & Selection': 'list-ul',
	'Dialogs & Modals': 'chat-square-text',
	'Progress & Status': 'reception-4',
	'Overlays & Effects': 'stars',
	'Resource Bars': 'heart-pulse',
	'Settings': 'sliders',
	'Visualization': 'bar-chart',
	'Character Management': 'person-circle',
	'Game Screens': 'window-stack',
	'Inventory & Items': 'box-seam',
	'Ability & Skills': 'lightning',
	'Input & Binding': 'keyboard',
	'Map & Navigation': 'map',
	'Social & Communication': 'chat-dots',
	'Progression & Content': 'trophy',
	'Gameplay Panels': 'hammer',
	'Social Panels': 'people',
	'UI Utilities & Specialized': 'tools',
}

const formatLabel = (key: string) => {
	return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export const GameComponentsPage = () => {
	const navigate = useNavigate()

	return (
		<div className="container py-5">
			<div className="mb-4">
				<Heading as="h1">Game Components</Heading>
				<Text as="p" variant="muted">{gameComponentExamples.length} components</Text>
			</div>
			{categories.map((category) => {
				const items = gameComponentExamples.filter((e) => e.category === category)
				if (items.length === 0) return null
				return (
					<div key={category} className="mb-4">
						<SectionCard
							title={category}
							icon={categoryIcons[category]}
							action={<Badge variant="secondary">{items.length}</Badge>}
						>
							<div className="row g-2">
								{items.map((example) => (
									<div key={example.key} className="col-sm-6 col-lg-4">
										<Button
											variant="secondary"
											outline
											className="w-100 d-flex align-items-center justify-content-between"
											onClick={() => navigate(`/game-components/${example.key}`)}
										>
											<span>{formatLabel(example.key)}</span>
											<Icon name="arrow-right" />
										</Button>
									</div>
								))}
							</div>
						</SectionCard>
					</div>
				)
			})}
		</div>
	)
}
