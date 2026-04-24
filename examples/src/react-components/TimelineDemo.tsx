import React from 'react'
import { Timeline, type TimelineItem } from '@toolcase/react-components'
import { DemoPage, DemoSection } from './_demo'

const timelineItems: TimelineItem[] = [
	{
		title: 'Project Kickoff',
		date: 'Jan 10, 2024',
		description: 'Initial alignment with stakeholders and core team formation with clear milestones.',
	},
	{
		title: 'Architecture Sign-off',
		date: 'Feb 04, 2024',
		description: 'Chose scalable micro-frontend approach with shared design system and CI/CD.',
	},
	{
		title: 'Beta Launch',
		date: 'Mar 18, 2024',
		description: 'Released first playable demo to a closed group; collected telemetry for tuning.',
	},
	{
		title: 'Global Release',
		date: 'May 02, 2024',
		description: 'Rolled out to all regions with localized assets, live events, and marketing push.',
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

const TimelineDemo: React.FC = () => {
	return (
		<DemoPage
			eyebrow="Data Display"
			title="Timeline"
			lede="A vertical timeline with alternating cards for major milestones, showing the date, title, and a short description for each event."
		>
			<DemoSection title="Default (4 items, overlap 50)">
				<Timeline items={timelineItems} overlap={50} />
			</DemoSection>

			<DemoSection title="Compact (no overlap)">
				<Timeline items={shortTimeline} overlap={0} />
			</DemoSection>
		</DemoPage>
	)
}

export default TimelineDemo
