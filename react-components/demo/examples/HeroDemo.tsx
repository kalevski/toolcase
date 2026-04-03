import React from 'react'
import { Hero, Card, CodeSnippet } from '../../src'

const HeroDemo: React.FC = () => (
	<div className="container my-5">
		<div className="row mb-4">
			<div className="col-12">
				<h1 className="display-4 text-gradient-primary mb-2">Hero</h1>
				<p className="text-muted mb-0">A landing page hero section with eyebrow, actions, stat cards, and metrics.</p>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Full Featured</h2>
					<Hero
						eyebrow="Now in public beta"
						title="Ship your web games faster"
						description="A cloud platform built for indie game developers. Host, deploy and scale your browser games with zero infrastructure headaches."
						primaryAction={{ label: 'Get Started Free', variant: 'primary', size: 'large' }}
						secondaryAction={{ label: 'View Docs', variant: 'secondary', outline: true }}
						statCards={[
							{ label: 'Active players', value: '12,482', helper: '+8% vs last week' },
							{ label: 'Avg. session time', value: '32m', helper: 'Peak engagement' },
							{ label: 'Retention', value: '91%', helper: '30-day rolling' },
						]}
						metrics={[
							{ label: 'studio teams', value: '180+', helper: 'building on platform' },
							{ label: 'ms response', value: '28ms', helper: 'global edge latency' },
							{ label: 'uptime', value: '99.99%', helper: 'multi-region' },
						]}
					/>
				</Card>
			</div>
		</div>

		<div className="row mb-5">
			<div className="col-12">
				<Card>
					<h2 className="h5 mb-3">Minimal (No Stats)</h2>
					<Hero
						title="Build amazing games"
						description="Everything you need to create, test, and publish browser-based games."
						primaryAction={{ label: 'Start Building', variant: 'primary' }}
					/>
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
						code={`import { Hero } from '@webgame-cloud/react-components'

<Hero
  title="Ship your web games faster"
  description="A cloud platform for indie game developers."
  primaryAction={{ label: 'Get Started Free', variant: 'primary' }}
  secondaryAction={{ label: 'View Docs', variant: 'secondary', outline: true }}
  statCards={[
    { label: 'Active players', value: '12,482', helper: '+8% vs last week' },
  ]}
/>`}
					/>
				</Card>
			</div>
		</div>
	</div>
)

export default HeroDemo
