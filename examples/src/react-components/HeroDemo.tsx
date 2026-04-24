import React from 'react'
import {
	Hero,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard
} from '@toolcase/react-components'

const HeroDemo: React.FC = () => (
	<div className="container py-4">
		<div className="row">
			<div className="col-12">
				<RichPageHeader
				chips={<RichPageHeaderChip>Layout & Surfaces</RichPageHeaderChip>}
				title="Hero"
				description="A landing page hero section with eyebrow, actions, stat cards, and metrics."
			/>
				<div className="d-flex flex-column gap-4 mt-4">
		<SectionCard title="Full Featured">
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
		</SectionCard>

		<SectionCard title="Minimal (No Stats)">
			<Hero
				title="Build amazing games"
				description="Everything you need to create, test, and publish browser-based games."
				primaryAction={{ label: 'Start Building', variant: 'primary' }}
			/>
		</SectionCard>
	</div>
		
			</div>
		</div>
	</div>
)

export default HeroDemo
