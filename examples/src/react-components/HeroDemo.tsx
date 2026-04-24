import React from 'react'
import { Hero } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const HeroDemo: React.FC = () => (
	<DemoPage
		eyebrow="Layout & Surfaces"
		title="Hero"
		lede="A landing page hero section with eyebrow, actions, stat cards, and metrics."
	>
		<DemoSection title="Full Featured">
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
		</DemoSection>

		<DemoSection title="Minimal (No Stats)">
			<Hero
				title="Build amazing games"
				description="Everything you need to create, test, and publish browser-based games."
				primaryAction={{ label: 'Start Building', variant: 'primary' }}
			/>
		</DemoSection>
	</DemoPage>
)

export default HeroDemo
