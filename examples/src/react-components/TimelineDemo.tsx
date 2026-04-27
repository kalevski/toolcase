import React from 'react'
import {
	Card,
	CodeSnippet,
	RichPageHeader,
	RichPageHeaderChip,
	SectionCard,
	Timeline,
	type TimelineItem
} from '@toolcase/react-components'

const timelineItems: TimelineItem[] = [
	{
		title: 'Project Kickoff',
		date: 'Jan 10, 2024',
		description: 'Initial alignment with stakeholders and core team formation with clear milestones.',
		status: 'completed',
		tags: ['Planning', 'Stakeholders'],
	},
	{
		title: 'Architecture Sign-off',
		date: 'Feb 04, 2024',
		description: 'Chose scalable micro-frontend approach with shared design system and CI/CD.',
		status: 'completed',
		tags: ['Architecture', 'CI/CD'],
	},
	{
		title: 'Beta Launch',
		date: 'Mar 18, 2024',
		description: 'Released first playable demo to a closed group; collected telemetry for tuning.',
		status: 'active',
		progress: 62,
		tags: ['Beta', 'Telemetry'],
	},
	{
		title: 'Global Release',
		date: 'May 02, 2024',
		description: 'Rolled out to all regions with localized assets, live events, and marketing push.',
		status: 'upcoming',
		badge: 'Planned',
	},
]

const shortTimeline: TimelineItem[] = [
	{
		title: 'Feature Request',
		date: 'Jun 01, 2024',
		description: 'Community requested real-time multiplayer support.',
	},
	{
		title: 'Implementation',
		date: 'Jul 15, 2024',
		description: 'WebSocket-based sync engine built and tested.',
	},
]

const accentTimeline: TimelineItem[] = [
	{
		title: 'Discovery',
		date: 'Q1 2024',
		description: 'User interviews and competitive research.',
		status: 'completed',
		accentColor: '#10b981',
	},
	{
		title: 'Design',
		date: 'Q2 2024',
		description: 'High-fidelity prototypes and design system updates.',
		status: 'active',
		progress: 45,
		accentColor: '#f59e0b',
	},
	{
		title: 'Build',
		date: 'Q3 2024',
		description: 'Engineering implementation and integration testing.',
		status: 'upcoming',
		accentColor: '#6366f1',
	},
]

const TimelineDemo: React.FC = () => {
	return (
		<div className="container py-4">
			<div className="row">
				<div className="col-12">
					<RichPageHeader
						chips={<RichPageHeaderChip>Data Display</RichPageHeaderChip>}
						title="Timeline"
						description="A vertical timeline with alternating cards for major milestones, multiple card variants, hover-active dots, and mobile-first responsiveness."
					/>
					<div className="d-flex flex-column gap-4 mt-4">
						<SectionCard title="Default — gradient connector, base cards">
							<Timeline items={timelineItems} overlap={50} />
						</SectionCard>

						<SectionCard title="Glass variant">
							<Timeline items={timelineItems} variant="glass" overlap={40} />
						</SectionCard>

						<SectionCard title="Outlined variant — dashed connector">
							<Timeline items={timelineItems} variant="outlined" connector="dashed" />
						</SectionCard>

						<SectionCard title="Elevated variant — solid connector">
							<Timeline items={timelineItems} variant="elevated" connector="solid" />
						</SectionCard>

						<SectionCard title="Minimal variant">
							<Timeline items={shortTimeline} variant="minimal" />
						</SectionCard>

						<SectionCard title="Per-item accent colors">
							<Timeline items={accentTimeline} variant="elevated" />
						</SectionCard>

						<SectionCard title="Loading state">
							<Timeline items={[]} loading loadingCount={3} />
						</SectionCard>

						<Card>
							<h2 className="h5 mb-3">Minimal usage</h2>
							<CodeSnippet
								language="typescript"
								code={`import { Timeline, type TimelineItem } from '@toolcase/react-components'

const items: TimelineItem[] = [
    { title: 'Kickoff', date: 'Jan 10', status: 'completed', tags: ['Planning'] },
    { title: 'Beta', date: 'Mar 18', status: 'active', progress: 62 },
    { title: 'Launch', date: 'May 02', status: 'upcoming', badge: 'Planned' },
]

<Timeline items={items} variant="glass" connector="dashed" />`}
							/>
						</Card>
					</div>
				</div>
			</div>
		</div>
	)
}

export default TimelineDemo
