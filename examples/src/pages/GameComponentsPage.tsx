import { useNavigate } from 'react-router'
import { Badge, Button, Heading, Icon, SectionCard, Text } from '@toolcase/react-components'
import { gameComponentExamples, categories, GameComponentCategory } from '../game-components/index'

const categoryIcons: Record<GameComponentCategory, string> = {
	'Basic Components': 'cube',
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
